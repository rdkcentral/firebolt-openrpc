/*
 * Copyright 2021 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import deepmerge from 'deepmerge'
import { getPath, localizeDependencies } from '../shared/json-schema.mjs'
import path from "path"

let convertTuplesToArraysOrObjects = false
const templates = {}
const state = {}
const primitives = {
  "integer": "number",
  "number": "number",
  "boolean": "boolean",
  "string": "string"
}

const isVoid = type => (type === 'void') ? true : false
const isPrimitiveType = type => primitives[type] ? true : false
const allocatedPrimitiveProxies = {}

function setTemplates(t) {
  Object.assign(templates, t)
}

function setPrimitives(p) {
  Object.assign(primitives, p)
}

function setConvertTuples(t) {
  convertTuplesToArraysOrObjects = t
}

function setAllocatedPrimitiveProxies(m) {
  Object.assign(allocatedPrimitiveProxies, m)
}

const capitalize = str => str ? str[0].toUpperCase() + str.substr(1) : str
const safeName = value => value.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()

// TODO: This is what's left of getMethodSignatureParams. We need to figure out / handle C's `FireboltTypes_StringHandle`
function getMethodSignatureParams(method, module, { destination, callback }) {
  const paramOptional = getTemplate('/parameters/optional')
  return method.params.map(param => {
    let type = getSchemaType(param.schema, module, { destination, namespace : true })
    if (callback && allocatedPrimitiveProxies[type]) {
      type = allocatedPrimitiveProxies[type]
    }

    let paramRequired = ''
    let jsonType = getJsonType(param.schema, module, { destination })
    if (!isPrimitiveType(jsonType) && getTemplate('/parameters/nonprimitive')) {
      paramRequired = getTemplate('/parameters/nonprimitive')
    }
    else if ((jsonType === 'string') && getTemplate('/parameters/string')) {
      paramRequired = getTemplate('/parameters/string')
    }
    else {
      paramRequired = getTemplate('/parameters/default')
    }

    return (param.required ? paramRequired : paramOptional).replace(/\$\{method\.param\.name\}/g, param.name).replace(/\$\{method\.param\.type\}/g, type)
  }).join(', ')
}

function getMethodSignatureResult(method, module, { destination, callback, overrideRule = false }) {
    let type = getSchemaType(method.result.schema, module, { destination, namespace : true })
    let result = ''

    if (callback) {
      let jsonType = getJsonType(method.result.schema, module, { destination })

      if (!isVoid(type) && !isPrimitiveType(jsonType) && getTemplate('/result-callback/nonprimitive')) {
        result = getTemplate('/result-callback/nonprimitive')
      }
      else if ((jsonType === 'string') && getTemplate('/result-callback/string')) {
        result = getTemplate('/result-callback/string')
      }
      else {
        result = getTemplate('/result-callback/default')
      }
    }
    else {
      result = getTemplate('/result/default')
    }
    return result.replace(/\$\{method\.result\.type\}/g, type)
}

const getTemplate = (name) => {
  if (name[0] !== '/') {
    name = '/' + name
  }
  return templates[Object.keys(templates).find(k => k === name)] || templates[Object.keys(templates).find(k => k.startsWith(name.split('.').shift() + '.'))] || ''
}

// TODO: this assumes the same title doesn't exist in multiple x-schema groups!
const getXSchemaGroup = (schema, module) => {
  let group = module.info.title

  if (schema.title && module['x-schemas']) {
    Object.entries(module['x-schemas']).forEach(([title, module]) => {
      Object.values(module).forEach(s => {
        if (schema.title === s.title) {
          group = title
        }
      })
    })
  }
  return group
}

function insertSchemaMacros(content, schema, module, name, parent, property, recursive = true) {
  const title = name || schema.title || ''
  let moduleTitle = getXSchemaGroup(schema, module)

  content = content
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{Title\}/g, capitalize(title))
    .replace(/\$\{TITLE\}/g, title.toUpperCase())
    .replace(/\$\{property\}/g, property)
    .replace(/\$\{Property\}/g, capitalize(property))
    .replace(/\$\{if\.namespace\.notsame}(.*?)\$\{end\.if\.namespace\.notsame\}/g, (module.info.title !== parent) ? '$1' : '')
    .replace(/\$\{parent\.title\}/g, parent)
    .replace(/\$\{parent\.Title\}/g, capitalize(parent))
    .replace(/\$\{description\}/g, schema.description ? schema.description : '')
    .replace(/\$\{summary\}/g, schema.description ? schema.description.split('\n')[0] : '')
    .replace(/\$\{name\}/g, title)
    .replace(/\$\{NAME\}/g, title.toUpperCase())
    .replace(/\$\{info.title\}/g, moduleTitle)
    .replace(/\$\{info.Title\}/g, capitalize(moduleTitle))
    .replace(/\$\{info.TITLE\}/g, moduleTitle.toUpperCase())

  if (recursive) {
    content = content.replace(/\$\{type\}/g, getSchemaType(schema, module, { destination: state.destination, section: state.section, code: false, namespace: true }))
  }
  return content
}

// TODO using JSON.stringify probably won't work for many languages...
const insertConstMacros = (content, schema, module, name) => {
  content = content.replace(/\$\{value\}/g, JSON.stringify(schema.const))
  return content
}

const insertEnumMacros = (content, schema, module, name) => {
  const template = content.split('\n')

  for (var i = 0; i < template.length; i++) {
    if (template[i].indexOf('${key}') >= 0) {
      template[i] = schema.enum.map(value => {
        return template[i].replace(/\$\{key\}/g, safeName(value))
          .replace(/\$\{value\}/g, value)
      }).join('\n')
    }
  }

  return template.join('\n')
}

const insertObjectAdditionalPropertiesMacros = (content, schema, module, title, options) => {
  const options2 = options ? JSON.parse(JSON.stringify(options)) : {}
  options2.parent = title
  options2.level = options.level + 1

  const shape = getSchemaShape(schema.additionalProperties, module, options2)
  let type = getSchemaType(schema.additionalProperties, module, options2).trimEnd()
  const propertyNames = localizeDependencies(schema, module).propertyNames

  let jsonType = getJsonType(schema.additionalProperties, module)
  if (!isPrimitiveType(jsonType)) {
    jsonType = 'string'
  }

  const additionalType = getPrimitiveType(jsonType, 'additional-types')
  let key = (propertyNames && propertyNames.title) ? propertyNames.title : getTemplate(path.join(options.templateDir, 'additionalPropertiesKey')).trimEnd()

  content = content
    .replace(/\$\{shape\}/g, shape)
    .replace(/\$\{parent\.title\}/g, title)
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{type\}/g, type)
    .replace(/\$\{additional\.type\}/g, additionalType)
    .replace(/\$\{key\}/g, key)
    .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, '')
    .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/g, '')

  return content
}

const insertObjectMacros = (content, schema, module, title, property, options) => {
  const options2 = options ? JSON.parse(JSON.stringify(options)) : {}
  options2.parent = title
  options2.level = options.level + 1

  ;(['properties', 'properties.register', 'properties.assign']).forEach(macro => {
    const indent = (content.split('\n').find(line => line.includes("${" + macro + "}")) || '').match(/^\s+/) || [''][0]
    const templateType = macro.split('.').slice(1).join('')
    const template = getTemplate(path.join(options.templateDir, 'property' + (templateType ? `-${templateType}` : ''))).replace(/\n/gms, indent + '\n')
  
    const properties = []

    if (schema.properties) {
      Object.entries(schema.properties).forEach(([name, prop], i) => {
        options2.property = name
        const schemaShape = getSchemaShape(prop, module, options2)
        const type = getSchemaType(prop, module, options2)

        // don't push properties w/ unsupported types
        if (type) {
          properties.push((i !== 0 ? indent : '') + template
          .replace(/(^\s+)/g, '$1'.repeat(options2.level))
          .replace(/\$\{property\}/g, name)
          .replace(/\$\{Property\}/g, capitalize(name))
          .replace(/\$\{parent\.title\}/g, title)
          .replace(/\$\{title\}/g, type)
          .replace(/\$\{shape\}/g, schemaShape)
          .replace(/\$\{description\}/g, prop.description || '')
          .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
          .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/gms, i === schema.properties.length - 1 ? '' : '$1')
          .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/gms, schema.required && schema.required.includes(name) ? '' : '$1'))
        }
      })
    }
  
    if (schema.propertyNames) {
      const { propertyNames } = localizeDependencies(schema, module)
      if (propertyNames.enum) {
        propertyNames.enum.forEach((prop, i) => {
          if (schema.properties && schema.properties[prop]) {
            // skip properties that were already defined above
            return
          }
          // TODO: add language config feature for 'unknown' type
          let type; // = { type: "null" }

          if (schema.additionalProperties && (typeof schema.additionalProperties === 'object')) {
            type = schema.additionalProperties
          }

          if (schema.patternProperties) {
            Object.entries(schema.patternProperties).forEach(([pattern, schema]) => {
              let regex = new RegExp(pattern)
              if (prop.match(regex)) {
                type = schema
              }
            })
          }

          if (type) {
            options2.property = prop
            const schemaShape = getSchemaShape(type, module, options2)
            properties.push((i !== 0 ? indent : '') + template
              .replace(/\$\{property\}/g, safeName(prop))
              .replace(/\$\{Property\}/g, capitalize(safeName(prop)))
              .replace(/\$\{parent\.title\}/g, title)
              .replace(/\$\{title\}/g, getSchemaType(type, module, options2))
              .replace(/\$\{shape\}/g, schemaShape)
              .replace(/\$\{description\}/g, prop.description || '')
              .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
              .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/gms, i === propertyNames.enum.length - 1 ? '' : '$1')
              .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/gms, schema.required && schema.required.includes(prop) ? '' : '$1'))
          }
        })
      }
    }
    
    const regex = new RegExp("\\$\\{" + macro + "\\}", "g")

    content = content.replace(regex, properties.join('\n'))
  })

  return content
}

const insertArrayMacros = (content, schema, module, name) => {
  return content
}

const insertTupleMacros = (content, schema, module, title, options) => {
  options.level = options.level + 1
  options.name = ''

  const propTemplate = getTemplate(path.join(options.templateDir, 'property'))
  const itemsTemplate = getTemplate(path.join(options.templateDir, 'items'))
  const propIndent = (content.split('\n').find(line => line.includes("${properties}")) || '').match(/^\s+/) || [''][0]
  const itemsIndent = (content.split('\n').find(line => line.includes("${items}")) || '').match(/^\s+/) || [''][0]
  const tupleDelimiter = getTemplate(path.join(options.templateDir, 'tuple-delimiter'))

  const doMacroWork = (str, prop, i, indent) => {
    const schemaShape = getSchemaShape(prop, module, options)

    return (i !== 0 ? indent : '') + str
      .replace(/\$\{property\}/g, prop['x-property'])
      .replace(/\$\{Property\}/g, capitalize(prop['x-property']))
      .replace(/\$\{parent\.title\}/g, title)
      .replace(/\$\{shape\}/g, schemaShape)
      .replace(/\$\{title\}/g, getSchemaType(prop, module, options))
      .replace(/\$\{description\}/g, prop.description || '')
      .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
      .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, i === schema.items.length - 1 ? '' : '$1')
      .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/gms, '')
  }

  content = content.replace(/\$\{properties\}/g, schema.items.map((prop, i) => doMacroWork(propTemplate, prop, i, propIndent)).join(tupleDelimiter))
  content = content.replace(/\$\{items\}/g, schema.items.map((prop, i) => doMacroWork(itemsTemplate, prop, i, itemsIndent)).join(tupleDelimiter))

  return content
}

const getPrimitiveType = (type, templateDir) => {
  const template = getTemplate(path.join(templateDir, type))
  return primitives[type] || template
}

const pickBestType = types => Array.isArray(types) ? types.find(t => t !== 'null') : types

const insertPrimitiveMacros = (content, schema, module, name, templateDir) => {
  content = content.replace(/\$\{type\}/g, getPrimitiveType(pickBestType(schema.type), templateDir))
  return content
}

const insertAnyOfMacros = (content, schema, module, name) => {
  const itemTemplate = content
  if (content.split('\n').find(line => line.includes("${type}"))) {
    content = schema.anyOf.map((item, i) => itemTemplate
      .replace(/\$\{type\}/g, getSchemaType(item, module))
      .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, i === schema.anyOf.length - 1 ? '' : '$1')
    ).join('')
  }

  return content
}

const sanitize = (schema) => {
  const result = JSON.parse(JSON.stringify(schema))

  if (result.oneOf && result.oneOf.length === 2 && result.oneOf.find(s => s.const === null)) {
    Object.assign(result, result.oneOf.find(s => s.const !== null))
    delete result.oneOf
  }

  if (result.anyOf && result.anyOf.length === 2 && result.anyOf.find(s => s.const === null)) {
    Object.assign(result, result.anyOf.find(s => s.const !== null))
    delete result.anyOf
  }

  return result
}

function getSchemaShape(schema = {}, module = {}, { templateDir = 'types', name = '', parent = '', property = '', level = 0, summary, descriptions = true, destination, section, enums = true, skipTitleOnce = false } = {}) {
  schema = sanitize(schema)

  state.destination = destination
  state.section = section

  if (level === 0 && !schema.title) {
    return ''
  }

  const suffix = destination && ('.' + destination.split('.').pop()) || ''
  const theTitle = insertSchemaMacros(getTemplate(path.join(templateDir, 'title' + suffix)), schema, module, schema.title || name, parent, property, false)

  let result = level === 0 ? getTemplate(path.join(templateDir, 'default' + suffix)) : '${shape}'

  if (enums && level === 0 && schema.type === "string" && Array.isArray(schema.enum)) {
    result = getTemplate(path.join(templateDir, 'enum' + suffix))
    return insertSchemaMacros(insertEnumMacros(result, schema, module, theTitle), schema, module, theTitle, parent, property)
  }

  if (schema['$ref']) {
    const someJson = getPath(schema['$ref'], module)
    if (someJson) {
      return getSchemaShape(someJson, module, { templateDir, name, parent, property, level, summary, descriptions, destination, enums: false })
    }
    throw "Unresolvable $ref: " + schema['ref'] + ", in " + module.info.title
  }
  else if (schema.hasOwnProperty('const')) {
    const shape = insertConstMacros(getTemplate(path.join(templateDir, 'const' + suffix)), schema, module, theTitle)
    result = insertSchemaMacros(result.replace(/\$\{shape\}/g, shape), schema, module, theTitle, parent, property)
    return result
  }
  else if (!skipTitleOnce && (level > 0) && schema.title) {
    // TODO: allow the 'ref' template to actually insert the shape using getSchemaShape
    const innerShape = getSchemaShape(schema, module, { skipTitleOnce: true, templateDir, name, parent, property, level, summary, descriptions, destination, enums: false })

    const shape = getTemplate(path.join(templateDir, 'ref' + suffix))
      .replace(/\$\{shape\}/g, innerShape)

    result = result.replace(/\$\{shape\}/g, shape)
    return insertSchemaMacros(result, schema, module, theTitle, parent, property)
  }
  else if (schema.type === 'object') {
    let shape
    const additionalPropertiesTemplate = getTemplate(path.join(templateDir, 'additionalProperties'))
    if (additionalPropertiesTemplate && schema.additionalProperties && (typeof schema.additionalProperties === 'object')) {
      shape = insertObjectAdditionalPropertiesMacros(additionalPropertiesTemplate, schema, module, theTitle, { level, parent, templateDir, namespace: true })
    }
    else {
      shape = insertObjectMacros(getTemplate(path.join(templateDir, 'object' + suffix)), schema, module, theTitle, property, { level, parent, property, templateDir, descriptions, destination, section, enums, namespace: true })
    }
    result = result.replace(/\$\{shape\}/g, shape)
    return insertSchemaMacros(result, schema, module, theTitle, parent, property)
  }
  else if (schema.anyOf || schema.oneOf) {
    const template = getTemplate(path.join(templateDir, 'anyOfSchemaShape' + suffix))
    let shape
    if (template) {
        shape = insertAnyOfMacros(template, schema, module, theTitle)
    }
    else {
      // borrow anyOf logic, note that schema is a copy, so we're not breaking it.
      if (!schema.anyOf) {
        schema.anyOf = schema.oneOf
      }
      shape = insertAnyOfMacros(getTemplate(path.join(templateDir, 'anyOf' + suffix)), schema, module, theTitle)
    }
    if (shape) {
      result = result.replace(/\$\{shape\}/g, shape)
      return insertSchemaMacros(result, schema, module, theTitle, parent, property)
    }
    else {
      return ''
    }
  }
  else if (schema.allOf) {
    const merger = (key) => function (a, b) {
      if (a.const) {
        return JSON.parse(JSON.stringify(a))
      }
      else if (b.const) {
        return JSON.parse(JSON.stringify(b))
      }
      else {
        return deepmerge(a, b, { customMerge: merger })
      }
    }

    let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x).reverse()], {
      customMerge: merger
    })

    if (schema.title) {
      union.title = schema.title
    }
    delete union['$ref']

    return getSchemaShape(union, module, { templateDir, name, parent, property, level, summary, descriptions, destination, enums: false })
  }
  else if (schema.type === "array" && schema.items && isSupportedTuple(schema)) {
    // tuple
    const shape = insertTupleMacros(getTemplate(path.join(templateDir, 'tuple' + suffix)), schema, module, theTitle, { level, templateDir, descriptions, destination, section, enums })
    result = result.replace(/\$\{shape\}/g, shape)
    return insertSchemaMacros(result, schema, module, theTitle, parent, property)
  }
  else if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
    // array
    const items = getSchemaShape(schema.items, module, { templateDir, name, parent, property, level, summary, descriptions, destination, enums: false })
    const shape = insertArrayMacros(getTemplate(path.join(templateDir, 'array' + suffix)), schema, module, items)
    result = result.replace(/\$\{shape\}/g, shape)
    return insertSchemaMacros(result, schema, module, items, parent, property)
  }
  else if (schema.type) {
    const shape = insertPrimitiveMacros(getTemplate(path.join(templateDir, 'primitive' + suffix)), schema, module, theTitle, templateDir)
    result = result.replace(/\$\{shape\}/g, shape)
    if (level > 0) {
      return insertSchemaMacros(result, schema, module, theTitle, parent, property)
    }
  }

  return ''
}

const isHomogenous = schema => {
  if (schema.items && Array.isArray(schema.items)) {
    // all items have a type and they are all the same
    if (schema.items.length === 0) {
      return true
    }
    else if (schema.items.every(item => item.type) && schema.items.every(item => item.type === schema.items[0].type)) {
      return true
    }
    else if (schema.items.every(item => item.$ref) && schema.items.every(item => item.$ref === schema.items[0].$ref)) {
      return true
    }
    else {
      return false
    }
  }
  return true
}

const isTuple = schema => schema.items && Array.isArray(schema.items)

const isSupportedTuple = schema => {

  if (schema.items && Array.isArray(schema.items)) {
    // if the convert flag isn't set, then all tuples are supported
    if (!convertTuplesToArraysOrObjects) {
      return true
    }
    else {
      // if every item has an `x-property` extension, then this tuple is supported (tuple template can use ${property})
      if (schema.items.every(item => item['x-property'])) {
        return true
      }
      // For homogenous tuples just treat them as arrays (i.e. not tuples)
      else if (isHomogenous(schema)) {
        console.log(`Treating homogenous tuple as array ${schema.items.map(item => item.type||item.$ref).join(' | ')}: ${convertTuplesToArraysOrObjects}`)
        return false
      }
      else {
        console.log(`Warning: non-homogenous tuples not supported (schema: ${schema.title})`)
      }
    }
  }
  else {
    return false
  }
}

function getSchemaType(schema, module, { destination, templateDir = 'types', link = false, code = false, asPath = false, event = false, result = false, expandEnums = true, baseUrl = '', namespace = false } = {}) {
  const wrap = (str, wrapper) => wrapper + str + wrapper

  schema = sanitize(schema)

  const suffix = destination && ('.' + destination.split('.').pop()) || ''
  const namespaceStr = namespace ? getTemplate(path.join(templateDir, 'namespace' + suffix)) : ''
  const theTitle = insertSchemaMacros(namespaceStr + getTemplate(path.join(templateDir, 'title' + suffix)), schema, module, schema.title || '', getXSchemaGroup(schema, module), '', false)
  const allocatedProxy = event || result

  const title = schema.type === "object" || schema.enum ? true : false

  if (schema['$ref']) {
    if (schema['$ref'][0] === '#') {
      const refSchema = getPath(schema['$ref'], module)
      const includeNamespace = (module.info.title !== getXSchemaGroup(refSchema, module))
      return getSchemaType(refSchema, module, {destination, templateDir, link, code, asPath, event, result, expandEnums, baseUrl, namespace:includeNamespace })// { link: link, code: code, destination })
    }
    else {
      // TODO: This never happens... but might be worth keeping in case we link to an opaque external schema at some point?

      if (link) {
        return '[' + wrap(theTitle, code ? '`' : '') + '](' + schema['$ref'] + ')'
      }
      else {
        return wrap(theTitle, code ? '`' : '')
      }
    }
  }
  else if (title && schema.title) {
    if (link) {
      return '[' + wrap(theTitle, code ? '`' : '') + '](#' + schema.title.toLowerCase() + ')'
    }
    else {
      return wrap(theTitle, code ? '`' : '')
    }
  }
  else if (schema.const) {
    return (typeof schema.const === 'string' ? `'${schema.const}'` : schema.const)
  }
  else if (schema['x-method']) {
    const target = JSON.parse(JSON.stringify(module.methods.find(m => m.name === schema['x-method'].split('.').pop())))

    // transform the method copy params to be in the order of the x-additional-params array (and leave out any we don't want)
    if (schema['x-additional-params']) {
      const params = []
      schema['x-additional-params'].forEach(key => {
        params.push(target.params.find(p => p.name === key))
      })
      target.params = params
    }
    else {
      target.params = []
    }

    const params = getMethodSignatureParams(target, module, { destination })
    const template = getTemplate(path.join(templateDir, 'x-method'))
    return insertSchemaMacros(template.replace(/\$\{params\}/g, params), target.result.schema, module, theTitle, '', '', false)
  }
  else if (schema.type === 'string' && schema.enum) {
    let type = expandEnums ? schema.enum.map(e => wrap(e, '\'')).join(' | ') : schema.type
    if (code) {
      type = wrap(type, '`')
    }
    return type
  }
  // else if (schema.type === 'array' && Array.isArray(schema.items)) {
  //     // tuple
  // }
  else if ((schema.type === 'object' || (schema.type === 'array')) && schema.title) {
    const maybeGetPath = (path, json) => {
      try {
        return getPath(path, json)
      }
      catch (e) {
        return null
      }
    }

    const def = maybeGetPath('#/definitions/' + schema.title, module) || maybeGetPath('#/components/schemas/' + schema.title, module)

    if (def && link) {
      return '[' + wrap(theTitle, code ? '`' : '') + '](./' + '#' + schema.title.toLowerCase() + ')'
    }
    else {
      return wrap(theTitle, code ? '`' : '')
    }
  }
  else if (schema.type === 'array' && schema.items) {
    let firstItem
    if (Array.isArray(schema.items)) {
      if (!isHomogenous(schema.items)) {
        console.log(`Non-homogenous tuples not supported: ${schema.items} in ${module.info.title}, ${theTitle}`)
        return ''
      }
      firstItem = schema.items[0]

      // let type = '[' + schema.items.map(x => getSchemaType(x, module, { destination })).join(', ') + ']' // no links, no code
    }

    let template
    // Tuple -> Array
    if (convertTuplesToArraysOrObjects && isTuple(schema) && isHomogenous(schema)) {
      template = insertArrayMacros(getTemplate(path.join(templateDir, 'array')), schema, module)
      template = insertSchemaMacros(template, firstItem, module, getSchemaType(firstItem, module, {destination, templateDir, link, title, code, asPath, event, result, expandEnums, baseUrl, namespace }), '', '', false)
    }
    // Normal Array
    else if (!isTuple(schema)) {
      template = insertArrayMacros(getTemplate(path.join(templateDir, 'array')), schema, module)
      template = insertSchemaMacros(template, schema.items, module, getSchemaType(schema.items, module, {destination, templateDir, link, title, code, asPath, event, result, expandEnums, baseUrl, namespace }), '', '', true)
    }
    else {
      template = insertTupleMacros(getTemplate(path.join(templateDir, 'tuple')), schema, module, '', { templateDir })
      template = insertSchemaMacros(template, firstItem, module, '', '', '', false)
    }

    if (code) {
      template = wrap(template, '`')
    }
    // TODO need to support link: true
    return template
  }
  else if (schema.allOf) {
    let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x)])
    if (schema.title) {
      union.title = schema.title
    }
    return getSchemaType(union, module, { destination, link, title, code, asPath, baseUrl, namespace })
  }
  else if (schema.oneOf || schema.anyOf) {
    if (!schema.anyOf) {
      schema.anyOf = schema.oneOf
    }
    // todo... we probably shouldn't allow untitled anyOfs, at least not w/out a feature flag
    const shape = insertAnyOfMacros(getTemplate(path.join(templateDir, 'anyOf' + suffix)), schema, module, theTitle)
    return insertSchemaMacros(shape, schema, module, theTitle, '', '', false)

    
    // if (event) {
    //   return getSchemaType((schema.oneOf || schema.anyOf)[0], module, { destination, link, title, code, asPath, baseUrl })
    // }
    // else {
    //   const newOptions = JSON.parse(JSON.stringify({ destination, link, title, code, asPath, baseUrl }))
    //   newOptions.code = false
    //   const result = (schema.oneOf || schema.anyOf).map(s => getSchemaType(s, module, newOptions)).join(' | ')

    //   return code ? wrap(result, '`') : result
    // }
  }
  else if (schema.type) {
    const template = getTemplate(path.join(templateDir, 'additionalProperties'))
    if (schema.additionalProperties && template ) {
      return insertSchemaMacros(getTemplate(path.join(templateDir, 'Title')), schema, module, theTitle, '', '', false)
    }
    else {
      // TODO: this assumes that when type is an array of types, that it's one other primative & 'null', which isn't necessarily true.
      const schemaType = !Array.isArray(schema.type) ? schema.type : schema.type.find(t => t !== 'null')
      const primitive = getPrimitiveType(schemaType, templateDir)
      const type = allocatedProxy ? allocatedPrimitiveProxies[schemaType] || primitive : primitive
      return wrap(type, code ? '`' : '')
    }
  }
  else {
    // TODO this is TypeScript specific
    return wrap('void', code ? '`' : '')
  }
}

function getJsonType(schema, module, { destination, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {

  schema = sanitize(schema)
  let type
  if (schema['$ref']) {
    if (schema['$ref'][0] === '#') {
      //Ref points to local schema
      //Get Path to ref in this module and getSchemaType
      let definition = getPath(schema['$ref'], module)
      type = getJsonType(definition, schema, {destination})
    }
  }
  else {
    type = !Array.isArray(schema.type) ? schema.type : schema.type.find(t => t !== 'null')
  }
  return type
}

function getSchemaInstantiation(schema, module, { instantiationType }) {
  return ''
}

export default {
  setTemplates,
  setPrimitives,
  setConvertTuples,
  setAllocatedPrimitiveProxies,
  getMethodSignatureParams,
  getMethodSignatureResult,
  getSchemaShape,
  getSchemaType,
  getSchemaInstantiation
}
