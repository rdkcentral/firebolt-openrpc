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
import { getPath, getSafeEnumKeyName, localizeDependencies } from './json-schema.mjs'

const isSynchronous = m => !m.tags ? false : m.tags.map(t => t.name).find(s => s === 'synchronous')

function getMethodSignature(method, module, { destination, isInterface = false }) {
    let typescript = (isInterface ? '' : 'function ') + method.name + '('

    typescript += getMethodSignatureParams(method, module, { destination })
    typescript += '): ' + (isSynchronous(method) ? getSchemaType(method.result.schema, module, {title: true}) : 'Promise<' + getSchemaType(method.result.schema, module, {title: true}) + '>')
    
    return typescript
}

function getMethodSignatureParams(method, module, { destination }) {
    return method.params.map( param => param.name + (!param.required ? '?' : '') + ': ' + getSchemaType(param.schema, module, {title: true, destination })).join(', ')
}

const safeName = prop => prop.match(/[.+]/) ? '"' + prop + '"' : prop

function getSchemaShape(schema = {}, module = {}, { name = '', level = 0, title, summary, descriptions = true, destination, enums = true } = {}) {
    schema = JSON.parse(JSON.stringify(schema))
    let structure = []

    let prefix = (level === 0 ? 'type ' : '')
    let operator = (level == 0 ? ' =' : ':')
    let theTitle = (level === 0 ? schema.title || name : name)

    if (enums && level === 0 && schema.type === "string" && Array.isArray(schema.enum)) {
      return `enum ${schema.title || name} {\n\t` + schema.enum.map(value => getSafeEnumKeyName(value) + ` = '${value}'`).join(',\n\t') + '\n}\n'
    }

    if (!theTitle) {
      prefix = operator = theTitle = ''
    }

    if (schema['$ref']) {
      if (level === 0) {
        return `${prefix}${theTitle};`
      }
      else {
        const someJson = getPath(schema['$ref'], module)
        if (someJson) {
          return getSchemaShape(someJson, module, { name, level, title, summary, descriptions, destination, enums: false })
        }
        else {
          '  '.repeat(level) + `${prefix}${theTitle}${operator}`
        }
      }
    }
    else if (schema.hasOwnProperty('const')) {
      return '  '.repeat(level) + `${prefix}${theTitle}${operator} ` + JSON.stringify(schema.const)
    }
    else if (title && schema.title) {
      let summary = ''
      if (level > 0 && (summary || schema.description)) {
        summary = `\t// ${(summary || schema.description).split('\n')[0]}`
      }
      return '  '.repeat(level) + `${prefix}${theTitle}${operator} ` + schema.title + summary
    }
    else if (schema.type === 'object') {
      let suffix = '{'
  
      structure.push('  '.repeat(level) + `${prefix}${theTitle}${operator} ${suffix}`)
  
      if (schema.properties) {
        Object.entries(schema.properties).forEach(([name, prop]) => {
          if (!schema.required || !schema.required.includes(name)) {
            name = name + '?'
          }
          const schemaShape = getSchemaShape(prop, module, {name: name, summary: prop.description, descriptions: descriptions, level: level+1, title: true})
          structure.push(schemaShape)
        })
      }
      else if (schema.propertyNames) {
        const { propertyNames } = localizeDependencies(schema, module)
        if (propertyNames.enum) {
          propertyNames.enum.forEach(prop => {
            let type = 'any'

            if (schema.additionalProperties && (typeof schema.additionalProperties === 'object')) {
              type = getSchemaType(schema.additionalProperties, module)
            }          

            if (schema.patternProperties) {
              Object.entries(schema.patternProperties).forEach(([pattern, schema]) => {
                let regex = new RegExp(pattern)
                if (prop.match(regex)) {
                  type = getSchemaType(schema, module)
                }
              })
            }
    
            structure.push(getSchemaShape({type: type}, module, {name: safeName(prop), descriptions: descriptions, level: level+1}))
          })
        }
      }
      else if (schema.additionalProperties && (typeof schema.additionalProperties === 'object')) {
        let type = getSchemaType(schema.additionalProperties, module, { destination })
        structure.push(getSchemaShape({type: type}, module, {name: '[property: string]', descriptions: descriptions, level: level+1}))
      }
  
      structure.push('  '.repeat(level) + '}')
    }
    else if (schema.anyOf) {
      return '  '.repeat(level) + `${prefix}${theTitle}${operator} ` + schema.anyOf.map(s => getSchemaType(s, module, { name, level, title, summary, descriptions, destination })).join(' | ')
    }
    else if (schema.oneOf) {
      return '  '.repeat(level) + `${prefix}${theTitle}${operator} ` + schema.oneOf.map(s => getSchemaType(s, module, { name, level, title, summary, descriptions, destination })).join(' | ')
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

      return getSchemaShape(union, module, { name, level, title, summary, descriptions, destination })
    }
    else if (schema.type || schema.const) {
      const isArrayWithSchemaForItems = schema.type === 'array' && schema.items && !Array.isArray(schema.items)
      const isArrayWithSpecificItems = schema.type === 'array' && schema.items && Array.isArray(schema.items)
      
      // TODO: deal with fixed sized arrays vs arbitrary arrays
      let suffix
      let summary = ''
  
      if (schema.const) {
        suffix = JSON.stringify(schema.const)
      }
      else if (isArrayWithSchemaForItems) {
        suffix = getSchemaType(schema.items, module, { title: level ? true : false }) + '[]' // prefer schema title over robust descriptor
      }
      else if (isArrayWithSpecificItems) {
        suffix = '[' + schema.items.map(i => getSchemaType(i, module, {title: level ? true : false })).join(', ') + ']'
      }
      else {
        suffix = getSchemaType(schema, module, { title: level ? true : false }) // prefer schema title over robust descriptor
      }
      
      // if there's a summary or description, append it as a comment (description only gets first line)
      if (level > 0 && (summary || schema.description)) {
        summary = `\t// ${summary || schema.description.split('\n')[0]}`
      }
  
      if (suffix === 'array') {
        suffix = '[]'
      }
  
      if (theTitle === suffix) {
        return '  '.repeat(level) + `${prefix}${theTitle}`
      }
      else {
        return '  '.repeat(level) + `${prefix}${theTitle}${operator} ${suffix}${summary}`
      }
    }
  
    structure = structure.join('\n').split('\n')
  
    if (level === 0) {
      const length = str => str.length
      let max = Math.max(...structure.map(l => l.split('\t//')[0]).map(length)) + 2
      structure = structure.map( l => l.split('\t//').join(' '.repeat(max - l.split('\t//')[0].length) + '//'))
    }
    return structure.join('\n')
  }

  function getSchemaType(schema, module, { destination, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {
    const wrap = (str, wrapper) => wrapper + str + wrapper
  
    if (schema['$ref']) {
      if (schema['$ref'][0] === '#') {
        return getSchemaType(getPath(schema['$ref'], module), module, {title: true, link: link, code: code, destination})
      }
      else {
        // TODO: This never happens... but might be worth keeping in case we link to an opaque external schema at some point?
        const name = schema['$ref'].split('/').pop()

        if (link) {
          return '[' + wrap(name, code ? '`' : '') + '](' + schema['$ref'] + ')'
        }
        else {
          return wrap(name, code ? '`' : '')
        }
      }
    }
    else if (title && schema.title) {
      if (link) {
        return '[' + wrap(schema.title, code ? '`' : '') + '](#' + schema.title.toLowerCase() + ')'
      }
      else {
        return wrap(schema.title, code ? '`' : '')
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
    else if (schema.type === 'object' && schema.title) {
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
        return '[' + wrap(schema.title, code ? '`' : '') + '](./' + '#' + schema.title.toLowerCase() + ')'
      }
      else {
        return wrap(schema.title, code ? '`' : '')
      }
    }
    else if (schema.type) {
      const type = getTypeScriptType(Array.isArray(schema.type) ? schema.type.find(t => t !== 'null') : schema.type)
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
    const keyName = getSafeEnumKeyName(val)
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
      getMethodSignature,
      getMethodSignatureParams,
      getSchemaShape,
      getSchemaType,
      getJsonType,
      getSchemaInstantiation
  }