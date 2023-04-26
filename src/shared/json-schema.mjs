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
import crocks from 'crocks'
const { setPath, getPathOr } = crocks

const isNull = schema => {
  return (schema.type === 'null' || schema.const === null)
}

const isSchema = element => element.$ref || element.type || element.const || element.oneOf || element.anyOf || element.allOf

const refToPath = ref => {
  let path = ref.split('#').pop().substr(1).split('/')
  return path.map(x => x.match(/^[0-9]+$/) ? parseInt(x) : x)
}

const objectPaths = obj => {
  const isObject = val => typeof val === 'object'
  const addDelimiter = (a, b) => a ? `${a}/${b}` : b;

  const paths = (obj = {}, head = '#') => {
    return obj ? Object.entries(obj)
      .reduce((product, [key, value]) => {
        let fullPath = addDelimiter(head, key)
        return isObject(value) ?
            product.concat(paths(value, fullPath))
        : product.concat(fullPath)
      }, []) : [] 
  }
  return paths(obj);
}

const getExternalSchemaPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(refToPath)
    .filter(x => !/^#/.test(getPathOr(null, x, obj)))
}

const getLocalSchemaPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(refToPath)
    .filter(x => /^#.+/.test(getPathOr(null, x, obj)))
}

const getLinkedSchemaPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(refToPath)
}

const updateRefUris = (schema, uri) => {
  if (schema.hasOwnProperty('$ref') && (typeof schema['$ref'] === 'string')) {
    if (schema['$ref'].indexOf(uri+"#") === 0)
      schema['$ref'] = '#' + schema['$ref'].split("#")[1]
    else if (schema['$ref'] === '#')
      schema['$ref'] = '#/definitions/JSONSchema'
  }
  else if (typeof schema === 'object') {
    Object.keys(schema).forEach(key => updateRefUris(schema[key], uri))
  }
}

const removeIgnoredAdditionalItems = schema => {
  if (schema && schema.hasOwnProperty && schema.hasOwnProperty('additionalItems')) {
    if (!schema.hasOwnProperty('items') || !Array.isArray(schema.items)) {
      delete schema.additionalItems
    }
  }
  else if (schema && (typeof schema === 'object')) {
    Object.keys(schema).forEach(key => removeIgnoredAdditionalItems(schema[key]))
  }
}

const replaceUri = (existing, replacement, schema) => {
  if (schema && schema.hasOwnProperty && schema.hasOwnProperty('$ref') && (typeof schema['$ref'] === 'string')) {
    if (schema['$ref'].indexOf(existing) === 0) {
      schema['$ref'] = schema['$ref'].split('#').map( x => x === existing ? replacement : x).join('#')
    }
  }
  else if (schema && (typeof schema === 'object')) {
    Object.keys(schema).forEach(key => {
      replaceUri(existing, replacement, schema[key])
    })
  }  
}

const replaceRef = (existing, replacement, schema) => {
  if (schema) {
    if (schema.hasOwnProperty('$ref') && (typeof schema['$ref'] === 'string')) {
      if (schema['$ref'] === existing) {
        schema['$ref'] = replacement
      }
    }
    else if (typeof schema === 'object') {
      Object.keys(schema).forEach(key => {
        replaceRef(existing, replacement, schema[key])
      })
    }
  }
}

const getPath = (uri = '', moduleJson = {}) => {
  const [mainPath, subPath] = (uri || '').split('#')
  let result

  if (!uri) {
    throw "getPath requires a non-null uri parameter"
  }

  if (mainPath) {
    throw `Cannot call getPath with a fully qualified URI: ${uri}`
  }

  if (subPath) {
    result = getPathOr(null, subPath.slice(1).split('/'), moduleJson)
  }
  if (!result) {
    //throw `getPath: Path '${uri}' not found in ${moduleJson ? (moduleJson.title || moduleJson.info.title) : moduleJson}.`
    return null
  }
  else {
    return result
  }
}

function getSchemaConstraints(schema, module, options = { delimiter: '\n' }) {
  if (schema.schema) {
    schema = schema.schema
  }
  const wrap = (str, wrapper) => wrapper + str + wrapper

  if (schema['$ref']) {
    if (schema['$ref'][0] === '#') {
      return getSchemaConstraints(getPath(schema['$ref'], module), module, options)
    }
    else {
      return ''
    }
  }
  else if (schema.type === 'string') {
    let constraints = []

    typeof schema.format === 'string'   ? constraints.push(`format: ${schema.format}`) : null
    typeof schema.minLength === 'number' ? constraints.push(`minLength: ${schema.minLength}`) : null
    typeof schema.maxLength === 'number' ? constraints.push(`maxLength: ${schema.maxLength}`) : null
    typeof schema.pattern === 'string'   ? constraints.push(`pattern: ${schema.pattern}`) : null
    typeof schema.enum === 'object' ? constraints.push(`values: \`${schema.enum.map(v => `'${v}'`).join(' \\| ')}\``) : null

    return constraints.join(options.delimiter)
  }
  else if (schema.type === 'integer' || schema.type === 'number') {
    let constraints = []

    typeof schema.minimum === 'number'          ? constraints.push(`minumum: ${schema.minimum}`) : null
    typeof schema.maximum === 'number'          ? constraints.push(`maximum: ${schema.maximum}`) : null
    typeof schema.exclusiveMaximum === 'number' ? constraints.push(`exclusiveMaximum: ${schema.exclusiveMaximum}`) : null
    typeof schema.exclusiveMinimum === 'number' ? constraints.push(`exclusiveMinimum: ${schema.exclusiveMinimum}`) : null
    typeof schema.multipleOf === 'number'       ? constraints.push(`multipleOf: ${schema.multipleOf}`) : null

    return constraints.join(options.delimiter)    
  }
  else if (schema.type === 'array' && schema.items) {
    let constraints = []

    if (Array.isArray(schema.items)) {

    }
    else {
      constraints = [getSchemaConstraints(schema.items, module, options)]
    }

    return constraints.join(options.delimiter)    
  }
  else if (schema.oneOf || schema.anyOf) {
    return '' //See OpenRPC Schema for `oneOf` and `anyOf` details'
  }
  else {
    return ''
  }
}

const defaultLocalizeOptions = {
  externalOnly: false,                    // true: only localizes refs pointing to other documents, false: localizes all refs into this def
  mergeAllOfs: false,                     // true: does a deep merge on all `allOf` arrays, since this is possible w/out refs, and allows for **much** easier programatic inspection of schemas
  keepRefsAndLocalizeAsComponent: false   // true: localizes external schemas into definition.components.schemas, and changes the $refs to be local (use only on root RPC docs)
}

const schemaReferencesItself = (schema, path) => {
  const paths = getLocalSchemaPaths(schema).map(p => getPathOr(null, p, schema))
  path = '#/' + path.join('/')

  if (paths.includes(path)) {
    return true
  }
  return false
}

// TODO: get rid of schemas param, after updating the validate task to use addExternalSchemas
const localizeDependencies = (json, document, schemas = {}, options = defaultLocalizeOptions) => {
  if (typeof options === 'boolean') {
    // if we got a boolean, then inject it into the default options for the externalOnly value (for backwards compatibility)
    options = Object.assign(JSON.parse(JSON.stringify(defaultLocalizeOptions)), { externalOnly: options })
  }

  let definition = JSON.parse(JSON.stringify(json))
  let refs = getLocalSchemaPaths(definition)
  let unresolvedRefs = []

  if (!options.externalOnly) {
    while (refs.length > 0) {
      for (let i=0; i<refs.length; i++) {
        let path = refs[i]      
        const ref = getPathOr(null, path, definition)
        path.pop() // drop ref
        if (refToPath(ref).length > 1) {
          let resolvedSchema = JSON.parse(JSON.stringify(getPathOr(null, refToPath(ref), document)))
        
          if (schemaReferencesItself(resolvedSchema, refToPath(ref))) {
            resolvedSchema = null
          }

          if (!resolvedSchema) {
            resolvedSchema = { "$REF": ref}
            unresolvedRefs.push([...path])
          }
  
          if (path.length) {
            // don't loose examples from original object w/ $ref
            // todo: should we preserve other things, like title?
            const examples = getPathOr(null, [...path, 'examples'], definition)
            resolvedSchema.examples = examples || resolvedSchema.examples
            definition = setPath(path, resolvedSchema, definition)
          }
          else {
            delete definition['$ref']
            Object.assign(definition, resolvedSchema)
          }  
        }
      }
      refs = getLocalSchemaPaths(definition)
    }
  }
  
  refs = getExternalSchemaPaths(definition)
  while (refs.length > 0) {
    for (let i=0; i<refs.length; i++) {
      let path = refs[i]      
      const ref = getPathOr(null, path, definition)

      path.pop() // drop ref
      let resolvedSchema
      
      if (!resolvedSchema) {
        resolvedSchema = { "$REF": ref}
        unresolvedRefs.push([...path])
      }

      if (path.length) {
        // don't loose examples from original object w/ $ref
        // todo: should we preserve other things, like title?
        const examples = getPathOr(null, [...path, 'examples'], definition)
        resolvedSchema.examples = examples || resolvedSchema.examples

        if (options.keepRefsAndLocalizeAsComponent) {
          // if copying schemas, just drop them in components.schemas
          const title = ref.split('/').pop()
          definition.components = definition.components || {}
          definition.components.schemas = definition.components.schemas || {}
          definition.components.schemas[title] = resolvedSchema
          definition = setPath([...path, '$ref'], `#/components/schemas/${title}`, definition)
        }
        else {
          // otherwise, copy the schema definition to the exact location of the old $ref
          definition = setPath(path, resolvedSchema, definition)
        }
      }
      else {
        // TODO: do we need keepRefsAndLocalizeAsComponent support at the root? i don't think so, that would mean that an OpenRPC doc just pointed to another right from the root.
        delete definition['$ref']
        Object.assign(definition, resolvedSchema)
      }
    }
    refs = getExternalSchemaPaths(definition)
  }

  unresolvedRefs.forEach(ref => {
    let node = getPathOr({}, ref, definition)
    node['$ref'] = node['$REF']
    delete node['$REF']
  })

  if (options.mergeAllOfs) {
    const findAndMergeAllOfs = pointer => {
      if ((typeof pointer) !== 'object' || !pointer) {
        return
      }

      Object.keys(pointer).forEach( key => {

        if (Array.isArray(pointer) && key === 'length') {
          return
        }
        // do a depth-first search for `allOfs` to reduce complexity of merges
        if ((key !== 'allOf') && (typeof pointer[key] === 'object')) {
          findAndMergeAllOfs(pointer[key])
        }
        else if (key === 'allOf' && Array.isArray(pointer[key])) {
          const union = deepmerge.all(pointer.allOf.reverse()) // reversing so lower `title` attributes will win
          const title = pointer.title
          Object.assign(pointer, union)
          if (title) {
            pointer.title = title
          }
          delete pointer.allOf
        }
      })
    }

    findAndMergeAllOfs(definition)
  }

  return definition
}

const getLocalSchemas = (json = {}) => {
  return Array.from(new Set(getLocalSchemaPaths(json).map(path => getPathOr(null, path, json))))
}

const isDefinitionReferencedBySchema = (name = '', moduleJson = {}) => {
  const refs = objectPaths(moduleJson)
                .filter(x => /\/\$ref$/.test(x))
                .map(refToPath)
                .map(x => getPathOr(null, x, moduleJson))
                .filter(x => x === name)

  return (refs.length > 0)
}

export {
  getSchemaConstraints,
  getExternalSchemaPaths,
  getLocalSchemas,
  getLocalSchemaPaths,
  getLinkedSchemaPaths,
  getPath,
  isDefinitionReferencedBySchema,
  isNull,
  isSchema,
  localizeDependencies,
  replaceUri,
  replaceRef,
  removeIgnoredAdditionalItems
} 