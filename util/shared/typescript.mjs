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

import { getPath, getSchema } from './json-schema.mjs'
import deepmerge from 'deepmerge'
import { localizeDependencies } from './json-schema.mjs'
import { getLinkFromRef, getTitle } from './helpers.mjs'
import { getFilename } from './helpers.mjs'
import path from 'path'

const isSynchronous = m => !m.tags ? false : m.tags.map(t => t.name).find(s => s === 'synchronous')

function getMethodSignature(module, method, options={ isInterface: false }) {
    let typescript = (options.isInterface ? '' : 'function ') + method.name + '('

    typescript += getMethodSignatureParams(module, method)
    typescript += '): ' + (isSynchronous(method) ? getSchemaType(module, method.result, {title: true}) : 'Promise<' + getSchemaType(module, method.result, {title: true}) + '>')
    
    return typescript
}

function getMethodSignatureParams(module, method) {
    return method.params.map( param => param.name + (!param.required ? '?' : '') + ': ' + getSchemaType(module, param, {title: true})).join(', ')
}

const safeName = prop => prop.match(/[.+]/) ? '"' + prop + '"' : prop

function getSchemaShape(module, json, name, options = {level: 0, descriptions: true}) {
    let level = options.level 
    let descriptions = options.descriptions
    let structure = []

    let prefix = (level === 0 ? 'type ' : '')
    let operator = (level == 0 ? ' =' : ':')
    let title = (level === 0 ? json.title || name : name)

    if (!title) {
      prefix = operator = title = ''
    }

    if (json['$ref']) {
      if (level === 0) {
        return `${prefix}${title};`
      }
      else {
        return getSchemaShape(module, getPath(json['$ref'], module), name, options)
      }
    }
    else if (options.title && json.title) {
      let summary = ''
      if (level > 0 && (options.summary || json.description)) {
        summary = `\t// ${(options.summary || json.description).split('\n')[0]}`
      }
      return '  '.repeat(level) + `${prefix}${title}${operator} ` + json.title + summary
    }
    else if (json.type === 'object') {
      // TODO: maybe this should happen at the top of this method for all types? didn't want to make such a drastic change, though.
      json = localizeDependencies(json)

      let suffix = '{'
  
      structure.push('  '.repeat(level) + `${prefix}${title}${operator} ${suffix}`)
  
      if (json.properties) {
        Object.entries(json.properties).forEach(([name, prop]) => {
          if (!json.required || !json.required.includes(name)) {
            name = name + '?'
          }
          structure.push(getSchemaShape(module, prop, name, {summary: prop.description, descriptions: descriptions, level: level+1, title: true}))
        })
      }
      else if (json.propertyNames && json.propertyNames.enum) {
        json.propertyNames.enum.forEach(prop => {
          let type = 'any'
  
          if (json.patternProperties) {
            Object.entries(json.patternProperties).forEach(([pattern, schema]) => {
              let regex = new RegExp(pattern)
              if (prop.match(regex)) {
                type = getSchemaType(module, schema)
              }
            })
          }
  
          structure.push(getSchemaShape(module, {type: type}, safeName(prop), {descriptions: descriptions, level: level+1}))
        })
      }
      else if (json.patternProperties) {
        Object.entries(json.patternProperties).forEach(([pattern, schema]) => {
          let type = getSchemaType(module, schema)
          structure.push(getSchemaShape(module, {type: type}, '\'/'+pattern+'/\'', {descriptions: descriptions, level: level+1}))
        })        
      }
  
      structure.push('  '.repeat(level) + '}')
    }
    else if (json.anyOf) {
      return '  '.repeat(level) + `${prefix}${title}${operator} ` + json.anyOf.map(s => getSchemaType(module, s, options)).join(' | ')
    }
    else if (json.oneOf) {
      return '  '.repeat(level) + `${prefix}${title}${operator} ` + json.oneOf.map(s => getSchemaType(module, s, options)).join(' | ')
    }
    else if (json.allOf) {
      let union = deepmerge.all([...json.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x), options])
      if (json.title) {
        union.title = json.title
      }
      delete union['$ref']
      return getSchemaShape(module, union, name, options)
    }
    else if (json.type || json.const) {
      const isArrayWithSchemaForItems = json.type === 'array' && json.items && !Array.isArray(json.items)
      const isArrayWithSpecificItems = json.type === 'array' && json.items && Array.isArray(json.items)
      
      // TODO: deal with fixed sized arrays vs arbitrary arrays
      let suffix
      let summary = ''
  
      if (json.const) {
        suffix = JSON.stringify(json.const)
      }
      else if (isArrayWithSchemaForItems) {
        suffix = getSchemaType(module, json.items, { title: level ? true : false }) + '[]' // prefer schema title over robust descriptor
      }
      else if (isArrayWithSpecificItems) {
        suffix = '[' + json.items.map(i => getSchemaType(module, i, {title: level ? true : false })).join(', ') + ']'
      }
      else {
        suffix = getSchemaType(module, json, { title: level ? true : false }) // prefer schema title over robust descriptor
      }
      
      // if there's a summary or description, append it as a comment (description only gets first line)
      if (level > 0 && (options.summary || json.description)) {
        summary = `\t// ${options.summary || json.description.split('\n')[0]}`
      }
  
      if (suffix === 'array') {
        suffix = '[]'
      }
//      suffix += isArrayWithSchemaForItems ? '[]' : ''
  
      if (title === suffix) {
        return '  '.repeat(level) + `${prefix}${title}`
      }
      else {
        return '  '.repeat(level) + `${prefix}${title}${operator} ${suffix}${summary}`
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

  function getSchemaType(module, json, options = { link: false, title: false, code: false, asPath: false, baseUrl: '' }) {
    if (json.schema) {
      json = json.schema
    }
  
    const wrap = (str, wrapper) => wrapper + str + wrapper
  
    if (json['$ref']) {
      if (json['$ref'][0] === '#') {
        return getSchemaType(module, getPath(json['$ref'], module), {title: true, link: options.link, code: options.code})
      }
      else {
        // TODO: this assumes that the title of the external schema matches the last node in the path (which isn't guaranteed)


        const schema = getSchema(json['$ref'].split('#')[0]) || module
        const definition = getPath(json['$ref'], schema)
        const name = definition.title || json['$ref'].split('/').pop()

        if (options.link) {
          let link = options.baseUrl + getLinkFromRef(json['$ref'], options.asPath)

          if (options.asPath) {
            link = link.toLowerCase()
          }
  
          return '[' + wrap(name, options.code ? '`' : '') + '](' + link + ')' //(options.asPath ? '](../' : '](./') + namespace + '#' + name.toLowerCase() + ')'
        }
        else {
          return wrap(name, options.code ? '`' : '')
        }
      }
    }
    else if (options.title && json.title) {
      if (options.link) {
       return '[' + wrap(json.title, options.code ? '`' : '') + '](#' + json.title.toLowerCase() + ')'
      }
      else {
        return wrap(json.title, options.code ? '`' : '')
      }
    }
    else if (json.type === 'string' && json.enum) {
      let type = json.enum.map(e => wrap(e, '\'')).join(' | ')
      if (options.code) {
        type = wrap(type, '`')
      }
      return type
    }
    else if (json.type === 'array' && json.items) {
      if (Array.isArray(json.items)) {
        let type = '[' + json.items.map(x => getSchemaType(module, x)).join(', ') + ']' // no links, no code
  
        if (options.code) {
          type = wrap(type, '`')
        }
  
        return type
      }
      else {
        // grab the type for the non-array schema, so we get the link for free
        let type = getSchemaType(module, json.items, {code: options.code, link: options.link, title: options.title})
        // insert the [] into the type
        if (options.link) {
          type = type.replace(/\[(`?)(.*)(`?)\]/, '\[$1$2\[\]$3\]')
        }
        else {
          type = type.replace(/(`?)(.*)(`?)/, '$1$2\[\]$3')
        }
        return type
      }
    }
    else if (json.allOf) {
      let union = deepmerge.all([...json.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x), options])
      if (json.title) {
        union.title = json.title
      }
      return getSchemaType(module, union, options)
    }
    else if (json.oneOf || json.anyOf) {
      if (options.event) {
        return getSchemaType(module, (json.oneOf || json.anyOf)[0], options)
      }
      else {
        return (json.oneOf || json.anyOf)
        .map(s => getSchemaType(module, s, options)).join(' | ')
      }
    }
    else if (json.type === 'object' && json.title) {
      const maybeGetPath = (path, json) => {
        try {
          return getPath(path, json)
        }
        catch (e) {
          return null
        }
      }

      const def = maybeGetPath('#/definitions/' + json.title, module) || maybeGetPath('#/components/schemas/' + json.title, module)

      if (def && options.link) {
        return '[' + wrap(json.title, options.code ? '`' : '') + '](./' + '#' + json.title.toLowerCase() + ')'
      }
      else {
        return wrap(json.title, options.code ? '`' : '')
      }
    }
    else if (json.type) {
      const type = getTypeScriptType(json.type)
      return wrap(type, options.code ? '`' : '')
    }
    else {
      return wrap('void', options.code ? '`' : '')
    }
  }
  
  function getTypeScriptType(jsonType) {
    if (jsonType === 'integer') {
      return 'bigint'
    }
    else {
      return jsonType
    }
  }

  const enumReducer = (acc, val, i, arr) => {
    const keyName = val.replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()
    acc = acc + `    ${keyName} = '${val}'`
    if (i < arr.length-1) {
      acc = acc.concat(',\n')
    }
    return acc
  }

  const generateEnum = schema => {
    if (!schema.enum) {
      return ''
    }
    else {
      let str = ''
      str += schema.enum.reduce(enumReducer, `enum ${schema.title} {\n`)
      str += '\n}\n'
      return str
    }
  }

  export {
      getMethodSignature,
      getMethodSignatureParams,
      getSchemaShape,
      getSchemaType,
      generateEnum
  }