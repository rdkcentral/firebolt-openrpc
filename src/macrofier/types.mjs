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
let primitives = {
  "integer": "number",
  "number": "number",
  "boolean": "boolean",
  "string": "string"
}
const stdPrimitives = [ "integer", "number", "boolean", "string" ]

const isVoid = type => (type === 'void') ? true : false
const isPrimitiveType = type => stdPrimitives.includes(type) ? true : false
const allocatedPrimitiveProxies = {}
const isObject = schema => (schema.type === 'object') || (Array.isArray(schema.type) && schema.type.includes("object"))
function setTemplates(t) {
  Object.assign(templates, t)
}

function setPrimitives(p) {
  if (p) {
    primitives = p
  }
}

function setConvertTuples(t) {
  convertTuplesToArraysOrObjects = t
}

function setAllocatedPrimitiveProxies(m) {
  Object.assign(allocatedPrimitiveProxies, m)
}

const capitalize = str => str ? str[0].toUpperCase() + str.substr(1) : str
const indent = (str, padding) => {
  let first = true
  if (str) {
    return str.split('\n').map(line => {
      if (first) {
        first = false
        return line
      }
      else {
        return padding + line
      }
    }).join('\n')
  }
}

const safeName = value => value.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()

// TODO: This is what's left of getMethodSignatureParams. We need to figure out / handle C's `FireboltTypes_StringHandle`
function getMethodSignatureParams(method, module, { destination, callback }) {
  const paramOptional = getTemplate('/parameters/optional')
  let polymorphicPull = method.tags.find(t => t.name === 'polymorphic-pull')
  return method.params.map(param => {
    if (polymorphicPull && (param.name === 'correlationId')) {
      return
    }
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
  }).filter(param => param).join(', ')
}

function getMethodSignatureResult(method, module, { destination, callback }) {
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

const getXSchemaGroupFromProperties = (schema, title, properties, group) => {
  if (properties) {
    Object.entries(properties).forEach(([name, prop]) => {
      if ((schema.title === prop.title) || (prop.items && prop.items.title === schema.title)) {
        group = title
      }
      else {
        group = getXSchemaGroupFromProperties(schema, title, prop.properties, group)
      }
    })
  }
  return group
}

// TODO: this assumes the same title doesn't exist in multiple x-schema groups!
const getXSchemaGroup = (schema, module) => {
  let group = module.info.title

  if (schema.title && module['x-schemas']) {
    Object.entries(module['x-schemas']).forEach(([title, module]) => {
      Object.values(module).forEach(moduleSchema => {
        let schemas = moduleSchema.allOf ? moduleSchema.allOf : [moduleSchema]
        schemas.forEach((s) => {
          if (schema.title === s.title || schema.title === moduleSchema.title) {
            group = title
          } else {
            group = getXSchemaGroupFromProperties(schema, title, s.properties, group)
	  }
        })
      })
    })
  }
  return group
}

function insertSchemaMacros(content, schema, module, { name = '', parent = '', property = '', required = false, recursive = true, templateDir = 'types'}) {
  const title = name || schema.title || ''
  let moduleTitle = getXSchemaGroup(schema, module)

  content = content
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{Title\}/g, capitalize(title))
    .replace(/\$\{TITLE\}/g, title.toUpperCase())
    .replace(/\$\{property\}/g, property)
    .replace(/\$\{Property\}/g, capitalize(property))
    .replace(/\$\{if\.namespace\.notsame}(.*?)\$\{end\.if\.namespace\.notsame\}/g, (module.info.title !== (parent || moduleTitle)) ? '$1' : '')
    .replace(/\$\{parent\.title\}/g, parent || moduleTitle)
    .replace(/\$\{parent\.Title\}/g, capitalize(parent || moduleTitle))
    .replace(/\$\{description\}/g, schema.description ? schema.description : '')
    .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/gms, (Array.isArray(required) ? required.includes(property) : required) ? '' : '$1')
    .replace(/\$\{if\.non.optional\}(.*?)\$\{end\.if\.non.optional\}/gms, (Array.isArray(required) ? required.includes(property) : required) ? '$1' : '')
    .replace(/\$\{summary\}/g, schema.description ? schema.description.split('\n')[0] : '')
    .replace(/\$\{name\}/g, title)
    .replace(/\$\{NAME\}/g, title.toUpperCase())
    .replace(/\$\{info.title\}/g, moduleTitle)
    .replace(/\$\{info.Title\}/g, capitalize(moduleTitle))
    .replace(/\$\{info.TITLE\}/g, moduleTitle.toUpperCase())

  if (recursive) {
    content = content.replace(/\$\{type\}/g, getSchemaType(schema, module, { templateDir: templateDir, destination: state.destination, section: state.section, code: false, namespace: true }))
  }
  return content
}

// TODO using JSON.stringify probably won't work for many languages...
const insertConstMacros = (content, schema, module, name) => {
  content = content.replace(/\$\{value\}/g, (typeof schema.const === 'string' ? `'${schema.const}'` : schema.const))
  return content
}

const insertEnumMacros = (content, schema, module, name, suffix, templateDir = "types") => {
  const template = content.split('\n')

  for (var i = 0; i < template.length; i++) {
    if (template[i].indexOf('${key}') >= 0) {
      let values = []
      schema.enum.map(value => {
        if (!value) {
          value = getTemplate(path.join(templateDir, 'unset' + suffix))
	}
        value ? values.push(template[i].replace(/\$\{key\}/g, safeName(value))
                                       .replace(/\$\{value\}/g, value)) : ''
      })
      template[i] = values.map((value, id) => {
        return value.replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, id === values.length - 1 ? '' : '$1')
      }).join('\n')
    }
  }

  return template.join('\n')
}

const insertObjectAdditionalPropertiesMacros = (content, schema, module, title, options) => {
  const options2 = options ? JSON.parse(JSON.stringify(options)) : {}
  options2.parent = title
  options2.level = options.level + 1
  options2.required = options.required
  const shape = getSchemaShape(schema.additionalProperties, module, options2)
  let type = getSchemaType(schema.additionalProperties, module, options2).trimEnd()
  const propertyNames = localizeDependencies(schema, module).propertyNames

  let jsonType = getJsonType(schema.additionalProperties, module)
  if (!isPrimitiveType(jsonType)) {
    jsonType = 'string'
  }

  const additionalType = getPrimitiveType(jsonType, 'additional-types')

  let namespace = ''
  let defaultKey = true
  let key = getTemplate(path.join('types', 'additionalPropertiesKey')).trimEnd()
  if (propertyNames && propertyNames.title) {
     let parent = getXSchemaGroup(propertyNames, module)
     key = propertyNames.title
     namespace = getTemplate(path.join(options.templateDir, 'namespace'))
       .replace(/\$\{if\.namespace\.notsame}(.*?)\$\{end\.if\.namespace\.notsame\}/g, (module.info.title !== (parent || moduleTitle)) ? '$1' : '')
       .replace(/\$\{parent\.Title\}/g, (parent && module.info.title !== parent) ? parent : '')
     defaultKey = false
  }
  content = content
    .replace(/\$\{shape\}/g, shape)
    .replace(/\$\{if\.default\}(.*?)\$\{end\.if\.default\}/g, defaultKey ? '$1' : '')
    .replace(/\$\{if\.not.default\}(.*?)\$\{end\.if\.not.default\}/gms, defaultKey ? '' : '$1')
    .replace(/\$\{parent\.title\}/g, title)
    .replace(/\$\{title\}/g, title)
    .replace(/\$\{type\}/g, type)
    .replace(/\$\{additional\.type\}/g, additionalType)
    .replace(/\$\{key\}/g, key)
    .replace(/\$\{namespace\}/g, namespace)
    .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, '')
    .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/g, '')
    .replace(/\$\{if\.impl.optional\}(.*?)\$\{end\.if\.impl.optional\}/g, options.required ? '' : '$1')
    .replace(/\$\{if\.impl.non.optional\}(.*?)\$\{end\.if\.impl.non.optional\}/g, options.required ? '$1' : '')

  return content
}

const getIndents = level => level ? '    ' : ''
const insertObjectMacros = (content, schema, module, title, property, options) => {
  const options2 = options ? JSON.parse(JSON.stringify(options)) : {}
  options2.parent = title
  options2.parentLevel = options.parentLevel
  options2.level = options.level + 1
  options2.templateDir = options.templateDir
  ;(['properties', 'properties.register', 'properties.assign']).forEach(macro => {
    const indent = getIndents(options.parentLevel || (options.level ? 1 : 0))
    const templateType = macro.split('.').slice(1).join('')
    const template = getTemplate(path.join(options.templateDir, 'property' + (templateType ? `-${templateType}` : ''))).replace(/\n/gms, '\n' + indent)
    const properties = []
    if (schema.properties) {
      Object.entries(schema.properties).forEach(([name, prop], i) => {
        let localizedProp = localizeDependencies(prop, module)
        const subProperty = getTemplate(path.join(options2.templateDir, 'sub-property/object'))
        options2.templateDir += subProperty ? '/sub-property' : ''
        const objSeparator = getTemplate(path.join(options2.templateDir, 'object-separator'))
        if (localizedProp.type === 'array' || localizedProp.anyOf || localizedProp.oneOf || (typeof localizedProp.const === 'string')) {
           options2.property = name
           options2.required = schema.required
        } else {
           options2.property = options.property
           options2.required = schema.required && schema.required.includes(name)
        }
        const schemaShape = indent + getSchemaShape(localizedProp, module, options2).replace(/\n/gms, '\n' + indent)
        const type = getSchemaType(localizedProp, module, options2)
        // don't push properties w/ unsupported types
        if (type) {
          let replacedTemplate  = template
          .replace(/(^\s+)/g, '$1'.repeat(options2.level))
          .replace(/\$\{property\}/g, name)
          .replace(/\$\{Property\}/g, capitalize(name))
          .replace(/\$\{parent\.title\}/g, title)
          .replace(/\$\{title\}/g, type)
          .replace(/\$\{shape\}/g, schemaShape)
          .replace(/\$\{description\}/g, prop.description || '')
          .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
          .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/gms, i === schema.properties.length - 1 ? '' : '$1')
          .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/gms, ((schema.required && schema.required.includes(name)) || (localizedProp.required && localizedProp.required === true)) ? '' : '$1')
          .replace(/\$\{if\.non.optional\}(.*?)\$\{end\.if\.non.optional\}/gms, ((schema.required && schema.required.includes(name)) || (localizedProp.required && localizedProp.required === true)) ? '$1' : '')
          .replace(/\$\{if\.base\.optional\}(.*?)\$\{end\.if\.base\.optional\}/gms, options.required ? '' : '$1')
          .replace(/\$\{if\.non\.object\}(.*?)\$\{end\.if\.non\.object\}/gms, isObject(localizedProp) ? '' : '$1')
          .replace(/\$\{if\.non\.array\}(.*?)\$\{end\.if\.non\.array\}/gms, (localizedProp.type === 'array') ? '' : '$1')
          .replace(/\$\{if\.non\.anyOf\}(.*?)\$\{end\.if\.non\.anyOf\}/gms, (localizedProp.anyOf || localizedProp.anyOneOf) ? '' : '$1')
          .replace(/\$\{if\.non\.const\}(.*?)\$\{end\.if\.non\.const\}/gms, (typeof localizedProp.const === 'string') ? '' : '$1')
          let baseTitle = options.property
          if (isObject(localizedProp)) {
            replacedTemplate = replacedTemplate
              .replace(/\$\{if\.impl.optional\}(.*?)\$\{end\.if\.impl.optional\}/gms, ((schema.required && schema.required.includes(name)) || (localizedProp.required && localizedProp.required === true)) ? '' : '$1')
              .replace(/\$\{if\.impl.non.optional\}(.*?)\$\{end\.if\.impl.non.optional\}/gms, ((schema.required && schema.required.includes(name)) || (localizedProp.required && localizedProp.required === true)) ? '$1' : '')
              .replace(/\$\{property.dependency\}/g, ((options.level > 0) ? '${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}' : '') + objSeparator + name)
              .replace(/\$\{Property.dependency\}/g, ((options.level > 0) ? '${Property.dependency}' : '') + (objSeparator) + capitalize(name))
          }
          else {
            if (options2.level <= 1) {
              replacedTemplate = replacedTemplate
                .replace(/\$\{property.dependency\}/g, '')
                .replace(/\$\{Property.dependency\}/g, '')
                .replace(/\$\{if\.impl.optional\}(.*?)\$\{end\.if\.impl.optional\}/gms, '')
	    }
          }
	  replacedTemplate = replacedTemplate
            .replace(/\$\{obj\.separator}/g, objSeparator)
            .replace(/\$\{base.title\}/g, (baseTitle ? (baseTitle)[0].toLowerCase() + (baseTitle).substr(1) : '')).trimEnd()
            .replace(/\$\{base.Title\}/g, (baseTitle ? (baseTitle)[0].toUpperCase() + (baseTitle).substr(1) : '')).trimEnd()
          properties.push(replacedTemplate)
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
            properties.push(template
              .replace(/\$\{property\}/g, safeName(prop))
              .replace(/\$\{Property\}/g, capitalize(safeName(prop)))
              .replace(/\$\{parent\.title\}/g, title)
              .replace(/\$\{title\}/g, getSchemaType(type, module, options2))
              .replace(/\$\{shape\}/g, schemaShape)
              .replace(/\$\{description\}/g, prop.description || '')
              .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
              .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/gms, i === propertyNames.enum.length - 1 ? '' : '$1')
              .replace(/\$\{if\.optional\}(.*?)\$\{end\.if\.optional\}/gms, schema.required && schema.required.includes(prop) ? '' : '$1')
              .replace(/\$\{if\.non.optional\}(.*?)\$\{end\.if\.non.optional\}/gms, schema.required && schema.required.includes(prop) ? '$1' : ''))
          }
        })
      }
    }

    const regex = new RegExp("\\$\\{" + macro + "\\}", "g")
    content = content.replace(regex, properties.join('\n')).replace(/\$\{level}/g, options.parentLevel > 0 ? options.parentLevel : '')
    if (!schema.properties && !schema.additionalProperties) {
      if (schema.propertyNames && schema.propertyNames.enum) {
        content = getTemplate(path.join(options.templateDir, 'enum-empty-property'))
      }
      else {
        content = getTemplate(path.join(options.templateDir, 'object-empty-property'))
      }
    }
  })
  return content
}

const insertArrayMacros = (content, schema, module, level = 0, items, required = false) => {
  content = content
    .replace(/\$\{json\.type\}/g, getSchemaType(schema.items, module, { templateDir: 'json-types', destination: state.destination, section: state.section, code: false, namespace: true }))
    .replace(/\$\{items\}/g, items)
    .replace(/\$\{items\.with\.indent\}/g, required ? indent(items, '    ') : indent(items, '        '))
    .replace(/\$\{if\.impl.array.optional\}(.*?)\$\{end\.if\.impl.array.optional\}/gms, required ? '' : '$1')
    .replace(/\$\{if\.impl.array.non.optional\}(.*?)\$\{end\.if\.impl.array.non.optional\}/gms, required ? '$1' : '')

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
      .replace(/\$\{if\.impl.optional\}(.*?)\$\{end\.if\.impl.optional\}/gms, '')
  }

  content = content.replace(/\$\{properties\}/g, schema.items.map((prop, i) => doMacroWork(propTemplate, prop, i, propIndent)).join(tupleDelimiter))
  content = content.replace(/\$\{items\}/g, schema.items.map((prop, i) => doMacroWork(itemsTemplate, prop, i, itemsIndent)).join(tupleDelimiter))
  content = content.replace(/\$\{json\.type\}/g, getSchemaType(schema.items[0], module, { templateDir: 'json-types', destination: state.destination, section: state.section, code: false, namespace: true }))
  return content
}

const getPrimitiveType = (type, templateDir = 'types') => {
  const template = getTemplate(path.join(templateDir, type)) || getTemplate(path.join(templateDir, 'generic'))
  return (primitives[type] || template)
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

function getSchemaShape(schema = {}, module = {}, { templateDir = 'types', parent = '', property = '', required = false, parentLevel = 0, level = 0, summary, descriptions = true, destination, section, enums = true, skipTitleOnce = false, array = false, primitive = false } = {}) {
  schema = sanitize(schema)
  state.destination = destination
  state.section = section
  if (level === 0 && !schema.title && !primitive) {
    return ''
  }

  const suffix = destination && ('.' + destination.split('.').pop()) || ''
  const theTitle = insertSchemaMacros(getTemplate(path.join(templateDir, 'title' + suffix)), schema, module, { name: schema.title, parent, property, required, recursive: false })

  let result = level === 0 && !primitive ? getTemplate(path.join(templateDir, 'default' + suffix)) : '${shape}'

  let genericTemplate = getTemplate(path.join(templateDir, 'generic' + suffix))
  if (enums && level === 0 && Array.isArray(schema.enum) && ((schema.type === "string") || (schema.type[0] === "string"))) {
    result = getTemplate(path.join(templateDir, 'enum' + suffix)) || genericTemplate
    return insertSchemaMacros(insertEnumMacros(result, schema, module, theTitle, suffix, templateDir), schema, module, { name: theTitle, parent, property, required })
  }

  if (schema['$ref']) {
    const someJson = getPath(schema['$ref'], module)
    if (someJson) {
      return getSchemaShape(someJson, module, { templateDir, parent, property, required, parentLevel, level, summary, descriptions, destination, enums, array, primitive })
    }
    throw "Unresolvable $ref: " + schema['ref'] + ", in " + module.info.title
  }
  else if (schema.hasOwnProperty('const')) {
    const shape = insertConstMacros(getTemplate(path.join(templateDir, 'const' + suffix)) || genericTemplate, schema, module, theTitle)
    return insertSchemaMacros(result.replace(/\$\{shape\}/g, shape), schema, module, { name: theTitle, parent, property, required })
  }
  else if (!skipTitleOnce && (level > 0) && schema.title) {
    let enumType = (schema.type === 'string' && Array.isArray(schema.enum))
    // TODO: allow the 'ref' template to actually insert the shape using getSchemaShape
    const innerShape = getSchemaShape(schema, module, { skipTitleOnce: true, templateDir, parent, property, required, parentLevel, level, summary, descriptions, destination, enums: enumType, array, primitive })

    const shape = getTemplate(path.join(templateDir, 'ref' + suffix))
      .replace(/\$\{shape\}/g, innerShape)

    result = result.replace(/\$\{shape\}/g, shape)
    return insertSchemaMacros(result, schema, module, { name: theTitle, parent, property, required })
  }
  else if (isObject(schema)) {
    let shape
    const additionalPropertiesTemplate = getTemplate(path.join(templateDir, 'additionalProperties'))
    if (additionalPropertiesTemplate && schema.additionalProperties && (typeof schema.additionalProperties === 'object')) {
      shape = insertObjectAdditionalPropertiesMacros(additionalPropertiesTemplate, schema, module, theTitle, { level, parent, templateDir, namespace: true, required })
    }
    else {
      let objectLevel = array ? 0 : level
      shape = insertObjectMacros(getTemplate(path.join(templateDir, 'object' + (array ? '-array' : '') + suffix)) || genericTemplate, schema, module, theTitle, property, { parentLevel, level: objectLevel, parent, property, required, templateDir, descriptions, destination, section, enums, namespace: true, primitive })
    }
    result = result.replace(/\$\{shape\}/g, shape)
    if (level === 0) {
      result = result.replace(/\$\{if\.impl.optional\}(.*?)\$\{end\.if\.impl.optional\}/gms, (Array.isArray(required) ? required.includes(property) : required) ? '' : '$1')
      result = result.replace(/\$\{if\.impl.non.optional\}(.*?)\$\{end\.if\.impl.non.optional\}/gms, (Array.isArray(required) ? required.includes(property) : required) ? '$1' : '')
    }
    return insertSchemaMacros(result, schema, module, { name: theTitle, parent, property, required, templateDir })
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
      shape = insertAnyOfMacros(getTemplate(path.join(templateDir, 'anyOf' + suffix)) || genericTemplate, schema, module, theTitle)
    }
    if (shape) {
      result = result.replace(/\$\{shape\}/g, shape)
      return insertSchemaMacros(result, schema, module, { name: theTitle, parent, property, required })
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

    return getSchemaShape(union, module, { templateDir, parent, property, required, parentLevel, level, summary, descriptions, destination, enums: false, array, primitive })
  }
  else if (schema.type === "array" && schema.items && isSupportedTuple(schema)) {
    // tuple
    const shape = insertTupleMacros(getTemplate(path.join(templateDir, 'tuple' + suffix)) || genericTemplate, schema, module, theTitle, { level, templateDir, descriptions, destination, section, enums })
    result = result.replace(/\$\{shape\}/g, shape)
    return insertSchemaMacros(result, schema, module, { name: theTitle, parent, property, required, templateDir })
  }
  else if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
    // array
    const items = getSchemaShape(schema.items, module, { templateDir, parent, property, required, parentLevel: parentLevel + 1, level, summary, descriptions, destination, enums: false, array: true, primitive })
    const shape = insertArrayMacros(getTemplate(path.join(templateDir, 'array' + suffix)) || genericTemplate, schema, module, level, items, Array.isArray(required) ? required.includes(property) : required)
    result = result.replace(/\$\{shape\}/g, shape)
              .replace(/\$\{if\.object\}(.*?)\$\{end\.if\.object\}/gms, isObject(schema.items) ? '$1' : '')
              .replace(/\$\{if\.non\.object\}(.*?)\$\{end\.if\.non\.object\}/gms, (schema.items.type !== 'object') ? '$1' : '')
    return insertSchemaMacros(result, schema, module, { name: items, parent, property, required, templateDir })
  }
  else if (schema.type) {
    const shape = insertPrimitiveMacros(getTemplate(path.join(templateDir, 'primitive' + suffix)), schema, module, theTitle, templateDir)
    result = result.replace(/\$\{shape\}/g, shape)
    if (level > 0 || primitive) {
      return insertSchemaMacros(result, schema, module, { name: theTitle, parent, property, required, templateDir })
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
  const theTitle = insertSchemaMacros(namespaceStr + getTemplate(path.join(templateDir, 'title' + suffix)), schema, module, { name: schema.title, parent: getXSchemaGroup(schema, module), recursive: false })
  const allocatedProxy = event || result

  const title = schema.type === "object" || Array.isArray(schema.type) && schema.type.includes("object") || schema.enum ? true : false

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
    return insertConstMacros(getTemplate(path.join(templateDir, 'const' + suffix)), schema, module)
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
    return insertSchemaMacros(template.replace(/\$\{params\}/g, params), target.result.schema, module, { name: theTitle, recursive: false })
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
      template = insertSchemaMacros(template, firstItem, module, { name: getSchemaType(firstItem, module, {destination, templateDir, link, title, code, asPath, event, result, expandEnums, baseUrl, namespace }), recursive: false })
    }
    // Normal Array
    else if (!isTuple(schema)) {
      const baseDir = (templateDir !== 'json-types' ? 'types': templateDir)
      template = insertArrayMacros(getTemplate(path.join(baseDir, 'array')), schema, module)
      template = insertSchemaMacros(template, schema.items, module, { name: getSchemaType(schema.items, module, {destination, templateDir, link, title, code, asPath, event, result, expandEnums, baseUrl, namespace })})
    }
    else {
      template = insertTupleMacros(getTemplate(path.join(templateDir, 'tuple')), schema, module, '', { templateDir })
      template = insertSchemaMacros(template, firstItem, module, { recursive: false })
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
    return getSchemaType(union, module, { templateDir, destination, link, title, code, asPath, baseUrl, namespace })
  }
  else if (schema.oneOf || schema.anyOf) {
    if (!schema.anyOf) {
      schema.anyOf = schema.oneOf
    }
    // todo... we probably shouldn't allow untitled anyOfs, at least not w/out a feature flag
    const shape = insertAnyOfMacros(getTemplate(path.join(templateDir, 'anyOf' + suffix)), schema, module, theTitle)
    return insertSchemaMacros(shape, schema, module, { name: theTitle, recursive: false })

    
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
      return insertSchemaMacros(getTemplate(path.join(templateDir, 'Title')), schema, module, { name: theTitle, recursive: false })
    }
    else {
      // TODO: this assumes that when type is an array of types, that it's one other primative & 'null', which isn't necessarily true.
      const schemaType = !Array.isArray(schema.type) ? schema.type : schema.type.find(t => t !== 'null')
      const baseDir = (templateDir !== 'json-types' ? 'types': templateDir)
      const primitive = getPrimitiveType(schemaType, baseDir)
      const type = allocatedProxy ? allocatedPrimitiveProxies[schemaType] || primitive : primitive
      return wrap(type, code ? '`' : '')
    }
  }
  else {
    let type
    if (schema.title) {
      const baseDir = (templateDir !== 'json-types' ? 'types': templateDir)
      type = getPrimitiveType('string', baseDir)
    }
    const template = type || getTemplate(path.join(templateDir, 'void')) ||  'void'
    // TODO this is TypeScript specific
    return wrap(template, code ? '`' : '')
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
