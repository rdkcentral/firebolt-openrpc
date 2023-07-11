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

const templates = {}
const state = {}
const primitives = {
    "integer": "number",
    "number": "number",
    "boolean": "boolean",
    "string": "string"
}

function setTemplates(t) {
    Object.assign(templates, t)
}

function setPrimitives(p) {
    Object.assign(primitives, p)
}

const capitalize = str => str ? str[0].toUpperCase() + str.substr(1) : str
const safeName = value => value.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()

function getMethodSignatureParams(method, module, { destination }) {
    const paramRequired = getTemplate('/parameters/default')
    const paramOptional = getTemplate('/parameters/optional')
    return method.params.map( param => (param.required ? paramRequired : paramOptional).replace(/\$\{method\.param\.name\}/g, param.name).replace(/\$\{method\.param\.type\}/g, getSchemaType(param.schema, module, {title: true, destination }))).join(', ')
}

const getTemplate = (name) => {
    if (name[0] !== '/') {
        name = '/' + name
    }
    return templates[Object.keys(templates).find(k => k === name)] || templates[Object.keys(templates).find(k => k.startsWith(name.split('.').shift() + '.'))] || ''
}

function insertSchemaMacros(content, schema, module, name, recursive=true) {
    const title = name || schema.title || ''
    let moduleTitle = module.info.title

    // TODO: this assumes the same title doesn't exist in multiple x-schema groups!
    if (schema.title && module['x-schemas']) {
        Object.entries(module['x-schemas']).forEach(([title, module]) => {
            Object.values(module).forEach(s => {
                if (schema.title === s.title) {
                    moduleTitle = title
                }
            })
        })
    }

    content = content
        .replace(/\$\{title\}/g, title)
        .replace(/\$\{Title\}/g, capitalize(title))
        .replace(/\$\{TITLE\}/g, title.toUpperCase())
        .replace(/\$\{description\}/g, schema.description ? schema.description : '')
        .replace(/\$\{summary\}/g, schema.description ? schema.description.split('\n')[0] : '')
        .replace(/\$\{name\}/g, title)
        .replace(/\$\{NAME\}/g, title.toUpperCase())
        .replace(/\$\{info.title\}/g, moduleTitle)
        .replace(/\$\{info.Title\}/g, capitalize(moduleTitle))
        .replace(/\$\{info.TITLE\}/g, moduleTitle.toUpperCase())
    //        .replace(/\$\{type.link\}/g, getLinkForSchema(schema, module, { name: title }))

    if (recursive) {
        content = content.replace(/\$\{type\}/g, getSchemaType(schema, module, { name: title, destination: state.destination, section: state.section, code: false }))
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

const insertObjectMacros = (content, schema, module, name, options) => {
    options = JSON.parse(JSON.stringify(options))
    options.level = options.level + 1
    options.name = ''

    const template = content.split('\n')
    const indent = (template.find(line => line.includes("${property}")).match(/^\s+/) || [''])[0]

    for (var i = 0; i < template.length; i++) {
        if (template[i].indexOf('${property}') >= 0) {
            const propertyTemplate = template[i]
            template[i] = ''
            if (schema.properties) {
                template[i] = Object.entries(schema.properties).map(([name, prop], i) => {

                    const schemaShape = getSchemaShape(prop, module, options)
                    return propertyTemplate
                                .replace(/(^\s+)/g, '$1'.repeat(options.level))
                                .replace(/\$\{property\}/g, name)
                                .replace(/\$\{shape\}/g, schemaShape)
                                .replace(/\$\{description\}/g, prop.description || '')
                                .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
                                .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, i === schema.properties.length-1 ? '' : '$1')
                                .replace(/\$\{if\.optional\}(.*?)\$\{end\.optional\}/g, schema.required && schema.required.includes(name) ? '' : '$1')

                }).join('\n')
            }
            else if (schema.propertyNames) {
                const { propertyNames } = localizeDependencies(schema, module)
                if (propertyNames.enum) {
                    template[i] = propertyNames.enum.map((prop, i) => {
                        // TODO: add language config feature for 'unknown' type
                        let type = { type: "null" }

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

                        const schemaShape = getSchemaShape(type, module, options)
                        return propertyTemplate
                            .replace(/\$\{property\}/g, safeName(prop))
                            .replace(/\$\{shape\}/g, schemaShape)
                            .replace(/\$\{description\}/g, prop.description || '')
                            .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
                            .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, i === propertyNames.enum.length-1 ? '' : '$1')
                            .replace(/\$\{if\.optional\}(.*?)\$\{end\.optional\}/g, schema.required && schema.required.includes(prop) ? '' : '$1')
                        }).join('\n')
                }
            }
            else if (schema.additionalProperties && (typeof schema.additionalProperties === 'object')) {
                // TODO: this won't work for custom types, only primatives...
                // TODO: not all languages support additional properties...
                // TODO: this is hard coded to typescript
                let type = getSchemaType(schema.additionalProperties, module, options)
                const shape = getSchemaShape({ type: type }, module, options)
                template[i] = propertyTemplate
                    .replace(/\$\{property\}/g, '[property: string]')
                    .replace(/\$\{shape\}/g, shape)
                    .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, '')
                    .replace(/\$\{if\.optional\}(.*?)\$\{end\.optional\}/g, '')
                }
        }
        else if (i !== 0) {
            template[i] = indent.repeat(options.level-1) + template[i]
        }
    }

    return template.join('\n')
}

const insertArrayMacros = (content, schema, module, name) => {
    return content
}

const insertTupleMacros = (content, schema, module, name, options) => {
    const template = content.split('\n')
    options.level = options.level + 1
    options.name = ''

    for (var i = 0; i < template.length; i++) {
        if (template[i].indexOf('${property}') >= 0) {
            const propertyTemplate = template[i]
            template[i] = ''
            template[i] = schema.items.map((prop, i) => {

                const schemaShape = getSchemaShape(prop, module, options)
                return propertyTemplate
                            .replace(/\$\{property\}/g, prop['x-property'])
                            .replace(/\$\{shape\}/g, schemaShape)
                            .replace(/\$\{description\}/g, prop.description || '')
                            .replace(/\$\{summary\}/g, prop.description ? prop.description.split('\n')[0] : '')
                            .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, i === schema.items.length-1 ? '' : '$1')

            }).join('\n')
        }
    }

    return template.join('\n')
}

const insertPrimitiveMacros = (content, schema, module, name) => {
    content = content.replace(/\$\{type\}/g, primitives[schema.type])
    return content
}

const insertAnyOfMacros = (content, schema, module, name) => {
    const itemTemplate = content
    content = schema.anyOf.map((item, i) => itemTemplate
                                        .replace(/\$\{type\}/g, getSchemaType(item, module))
                                        .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, i === schema.anyOf.length-1 ? '' : '$1')
    ).join('')
    return content
}

function getSchemaShape(schema = {}, module = {}, { templateDir = 'types', name = '', property = '', level = 0, summary, descriptions = true, destination, section, enums = true } = {}) {
    schema = JSON.parse(JSON.stringify(schema))

    state.destination = destination
    state.section = section

    if (level === 0 && !schema.title) {
        return ''
    }

    const suffix = destination && ('.' + destination.split('.').pop()) || ''
    const theTitle = insertSchemaMacros(getTemplate(path.join(templateDir, 'title' + suffix)), schema, module, schema.title || '', false)

    let result = level === 0 ? getTemplate(path.join(templateDir, 'default' + suffix)) : '${shape}'

    if (enums && level === 0 && schema.type === "string" && Array.isArray(schema.enum)) {
        result = getTemplate(path.join(templateDir, 'enum' + suffix))
        return insertSchemaMacros(insertEnumMacros(result, schema, module, theTitle), schema, module, theTitle)
    }

    if (schema['$ref']) {
        const someJson = getPath(schema['$ref'], module)
        if (someJson) {
            return getSchemaShape(someJson, module, { name, level, summary, descriptions, destination, enums: false })
        }
        throw "Unresolvable $ref: " + schema['ref'] + ", in " + module.info.title
    }
    else if (schema.hasOwnProperty('const')) {
        const shape = insertConstMacros(getTemplate(path.join(templateDir, 'const' + suffix)), schema, module, theTitle)
        result = insertSchemaMacros(result.replace(/\$\{shape\}/g, shape), schema, module, theTitle)
        return result
    }
    else if (level > 0 && schema.title) {
        const shape = getTemplate(path.join(templateDir, 'ref' + suffix))
        result = result.replace(/\$\{shape\}/g, shape)
        return insertSchemaMacros(result, schema, module, theTitle)
    }
    else if (schema.type === 'object') {
        const shape = insertObjectMacros(getTemplate(path.join(templateDir, 'object' + suffix)), schema, module, theTitle, {level, descriptions, destination, section, enums })
        result = result.replace(/\$\{shape\}/g, shape)
        return insertSchemaMacros(result, schema, module, theTitle)
    }
    else if (schema.anyOf || schema.oneOf) {
        // borry anyOf logic, note that schema is a copy, so we're not breaking it.
        if (!schema.anyOf) {
            schema.anyOf = schema.oneOf
        }
        const shape = insertAnyOfMacros(getTemplate(path.join(templateDir, 'anyOf' + suffix)), schema, module, theTitle)
        result = result.replace(/\$\{shape\}/g, shape)
        return insertSchemaMacros(result, schema, module, theTitle)
    }
    else if (schema.allOf) {
      const merger = (key) => function(a, b) {
        if (a.const) {
          return JSON.parse(JSON.stringify(a))
        }
        else if (b.const) {
          return JSON.parse(JSON.stringify(b))
        }
        else {
          return deepmerge(a, b, {customMerge: merger})
        }
      }

      let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x).reverse()], {
        customMerge: merger
      })

      if (schema.title) {
        union.title = schema.title
      }
      delete union['$ref']

      return getSchemaShape(union, module, { name, level, summary, descriptions, destination })
    }
    else if (schema.type === "array" && schema.items && !Array.isArray(schema.items)) {
        // array
        const items = getSchemaShape(schema.items, module, { name, level, summary, descriptions, destination })
        const shape = insertArrayMacros(getTemplate(path.join(templateDir, 'array' + suffix)), schema, module, items)
        result = result.replace(/\$\{shape\}/g, shape)
        return insertSchemaMacros(result, schema, module, items)
    }
    else if (schema.type === "array" && schema.items && Array.isArray(schema.items)) {
        // tuple
        const shape = insertTupleMacros(getTemplate(path.join(templateDir, 'tuple' + suffix)), schema, module, theTitle, {level, descriptions, destination, section, enums })
        result = result.replace(/\$\{shape\}/g, shape)
        return insertSchemaMacros(result, schema, module, theTitle)
    }
    else if (schema.type) {
        const shape = insertPrimitiveMacros(getTemplate(path.join(templateDir, 'primitive' + suffix)), schema, module, theTitle)
        result = result.replace(/\$\{shape\}/g, shape)
        if (theTitle || level > 0) {
            return insertSchemaMacros(result, schema, module, theTitle)
        }
    }

    return ''
  }

  function getSchemaType(schema, module, { destination, templateDir = 'types', link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {
    const wrap = (str, wrapper) => wrapper + str + wrapper
  
    const suffix = destination && ('.' + destination.split('.').pop()) || ''
    const theTitle = insertSchemaMacros(getTemplate(path.join(templateDir, 'title' + suffix)), schema, module, schema.title || '', false)

    if (schema['$ref']) {
      if (schema['$ref'][0] === '#') {
        return getSchemaType(getPath(schema['$ref'], module), module, {title: true, link: link, code: code, destination})
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

      // TODO: this is TypeScript specific
      const params = getMethodSignatureParams(target, module, { destination })
      const result = getSchemaType(target.result.schema, module, { destination })
      return `(${params}) => Promise<${result}>`
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
    else if ((schema.type === 'object' || (schema.type === 'array' && Array.isArray(schema.items))) && schema.title) {
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
      if (Array.isArray(schema.items)) {
        let type = '[' + schema.items.map(x => getSchemaType(x, module, { destination })).join(', ') + ']' // no links, no code
  
        if (code) {
          type = wrap(type, '`')
        }
  
        return type
      }
      else {
        // grab the type for the non-array schema, so we get the link for free
        let type = getSchemaType(schema.items, module, {code: code, link: link, title: title, destination})
        // insert the [] into the type
        if (link) {
          type = type.replace(/\[(`?)(.*)(`?)\]/, '\[$1$2\[\]$3\]')
        }
        else {
          type = type.replace(/(`?)(.*)(`?)/, '$1$2\[\]$3')
        }
        return type
      }
    }
    else if (schema.allOf) {
      let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x)])
      if (schema.title) {
        union.title = schema.title
      }
      return getSchemaType(union, module, { destination, link, title, code, asPath, baseUrl })
    }
    else if (schema.oneOf || schema.anyOf) {
      if (event) {
        return getSchemaType((schema.oneOf || schema.anyOf)[0], module, { destination, link, title, code, asPath, baseUrl })
      }
      else {
        const newOptions = JSON.parse(JSON.stringify({ destination, link, title, code, asPath, baseUrl }))
        newOptions.code = false
        const result = (schema.oneOf || schema.anyOf).map(s => getSchemaType(s, module, newOptions)).join(' | ')

        return code ? wrap(result, '`') : result
      }
    }
    else if (schema.type) {
      const type = !Array.isArray(schema.type) ? primitives[schema.type] : primitives[schema.type.find(t => t !== 'null')]
      return wrap(type, code ? '`' : '')
    }
    else {
      return wrap('void', code ? '`' : '')
    }
  }

  function getJsonType(schema, module, { destination, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {
    return ''
  }

  function getTypeScriptType(jsonType) {
    if (jsonType === 'integer') {
      return 'number'
    }
    else {
      return jsonType
    }
  }

  const enumReducer = (acc, val, i, arr) => {
    const keyName = val.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()
    acc = acc + `    ${keyName} = '${val}'`
    if (i < arr.length-1) {
      acc = acc.concat(',\n')
    }
    return acc
  }

  function getSchemaInstantiation(schema, module, { instantiationType }) {
    return ''
  }

  export default {
    setTemplates,
    setPrimitives,
      getMethodSignatureParams,
      getSchemaShape,
      getSchemaType,
      getJsonType,
      getSchemaInstantiation
  }