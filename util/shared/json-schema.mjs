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

import crocks from 'crocks'
const { setPath, getPathOr } = crocks

const isNull = schema => {
  return (schema.type === 'null' || schema.const === null)
}

const getExternalMarkdownPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(refToPath)
    .filter(x => /^file:/.test(getPathOr(null, x, obj)))
}

const refToPath = ref => {
  let path = ref.split('#').pop().substr(1).split('/')
  return path.map(x => x.match(/[0-9]+/) ? parseInt(x) : x)
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

const localRefPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(refToPath)
    .filter(x => /^#/.test(getPathOr(null, x, obj)))
}


// - Replace JSONSchema $ref in definitions w/ entire jsonschema
// - move/flatten definitions up
// - remove $schema & $id
// - replace all githubusercontent URLs
const flattenSchemas = (schema, meta) => {
  delete schema.definitions[meta.title]['$ref']

  Object.keys(meta).forEach(key => {
    if (key === 'definitions') {
      // copy up one level
      Object.keys(meta[key]).forEach(dkey => {
        schema[key][dkey] = meta[key][dkey]
      })
    }
    else if (key[0] !== '$')
      schema.definitions[meta.title][key] = meta[key]
  })

  updateRefUris(schema, "https://raw.githubusercontent.com/json-schema-tools/meta-schema/1.5.9/src/schema.json")
  removeIgnoredAdditionalItems(schema)
  schema.definitions.JSONSchema = {
    "oneOf": [
      { "$ref": "#/definitions/JSONSchemaObject" },
      { "$ref": "#/definitions/JSONSchemaBoolean" }
    ]    
  }
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
  if (schema.hasOwnProperty('additionalItems')) {
    if (!schema.hasOwnProperty('items') || !Array.isArray(schema.items)) {
      delete schema.additionalItems
    }
  }
  else if (typeof schema === 'object') {
    Object.keys(schema).forEach(key => removeIgnoredAdditionalItems(schema[key]))
  }
}

const replaceUri = (existing, replacement, schema) => {
  if (schema.hasOwnProperty('$ref') && (typeof schema['$ref'] === 'string')) {
    if (schema['$ref'].indexOf(existing) === 0) {
      schema['$ref'] = schema['$ref'].split('#').map( x => x === existing ? replacement : x).join('#')
    }
  }
  else if (typeof schema === 'object') {
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

const getPath = (uri = '', moduleJson = {}, schemas = {}) => {
  const [mainPath, subPath] = (uri || '').split('#')
  let result

  if (!uri) {
    throw "getPath requires a non-null uri parameter"
  }

  if (mainPath) {
    result = getExternalPath(uri, schemas, true)
  }
  else if (subPath) {
    result = getPathOr(null, subPath.slice(1).split('/'), moduleJson)
  }
  if (!result) {
    throw `getPath: Path '${uri}' not found in ${moduleJson ? (moduleJson.title || moduleJson.info.title) : moduleJson}.`
  }
  else {
    return result
  }
}

// grab a schema from another file in this project
const getExternalPath = (uri = '', schemas = {}, localize = true, replace = true) => {
  const [mainPath, subPath] = uri.split('#')
  const json = schemas[mainPath] || schemas[mainPath + '/']
  // copy to avoid side effects
  let result = JSON.parse(JSON.stringify(subPath ? getPathOr(null, subPath.slice(1).split('/'), json) : json))

  if (localize) {
    result && (result = localizeDependencies(result, json, schemas))
  }
  else if (replace) {
    result && replaceUri('', mainPath, result)
  }

  return result
}

const getSchema = (uri, schemas) => {
  return getExternalPath(uri, schemas, false, false)
}

function getSchemaConstraints(json, module, schemas = {}, options = { delimiter: '\n' }) {
  if (json.schema) {
    json = json.schema
  }

  const wrap = (str, wrapper) => wrapper + str + wrapper

  if (json['$ref']) {
    if (json['$ref'][0] === '#') {
      return getSchemaConstraints(getPath(json['$ref'], module, schemas), module, schemas, options)
    }
    else {
      return ''
    }
  }
  else if (json.type === 'string') {
    let constraints = []

    typeof json.format === 'string'   ? constraints.push(`format: ${json.format}`) : null
    typeof json.minLength === 'number' ? constraints.push(`minLength: ${json.minLength}`) : null
    typeof json.maxLength === 'number' ? constraints.push(`maxLength: ${json.maxLength}`) : null
    typeof json.maxLength === 'number' ? constraints.push(`maxLength: ${json.maxLength}`) : null
    typeof json.pattern === 'string'   ? constraints.push(`pattern: ${json.pattern}`) : null

    return constraints.join(options.delimiter)
  }
  else if (json.type === 'integer' || json.type === 'number') {
    let constraints = []

    typeof json.minimum === 'number'          ? constraints.push(`minumum: ${json.minimum}`) : null
    typeof json.maximum === 'number'          ? constraints.push(`maximum: ${json.maximum}`) : null
    typeof json.exclusiveMaximum === 'number' ? constraints.push(`exclusiveMaximum: ${json.exclusiveMaximum}`) : null
    typeof json.exclusiveMinimum === 'number' ? constraints.push(`exclusiveMinimum: ${json.exclusiveMinimum}`) : null
    typeof json.multipleOf === 'number'       ? constraints.push(`multipleOf: ${json.multipleOf}`) : null

    return constraints.join(options.delimiter)    
  }
  else if (json.type === 'array' && json.items) {
    let constraints = []

    if (Array.isArray(json.items)) {

    }
    else {
      constraints = [getSchemaConstraints(json.items, module, options)]
    }

    return constraints.join(options.delimiter)    
  }
  else if (json.oneOf || json.anyOf) {
    return 'See OpenRPC Schema for `oneOf` and `anyOf` details'
  }
  else {
    return ''
  }
}

const localizeDependencies = (def, schema, schemas = {}, externalOnly=false) => {
  let definition = JSON.parse(JSON.stringify(def))
  let refs = localRefPaths(definition)
  let unresolvedRefs = []

  if (!externalOnly) {
    while (refs.length > 0) {
      for (let i=0; i<refs.length; i++) {
        let path = refs[i]      
        const ref = getPathOr(null, path, definition)
        path.pop() // drop ref
        let resolvedSchema = getPathOr(null, refToPath(ref), schema)
        
        if (!resolvedSchema) {
          resolvedSchema = { "$REF": ref}
          unresolvedRefs.push([...path])
        }

        if (path.length) {
          definition = setPath(path, resolvedSchema, definition)
        }
        else {
          delete definition['$ref']
          Object.assign(definition, resolvedSchema)
        }
      }
      refs = localRefPaths(definition)
    }
  }
  
  refs = getExternalSchemaPaths(definition)
  while (refs.length > 0) {
    for (let i=0; i<refs.length; i++) {
      let path = refs[i]      
      const ref = getPathOr(null, path, definition)
      path.pop() // drop ref
      let resolvedSchema = getExternalPath(ref, schemas, true)
      
      if (!resolvedSchema) {
        resolvedSchema = { "$REF": ref}
        unresolvedRefs.push([...path])
      }

      if (path.length) {
        definition = setPath(path, resolvedSchema, definition)
      }
      else {
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

  return definition
}

const getExternalSchemas = (json = {}, schemas = {}) => {
  // make a copy for safety!
  json = JSON.parse(JSON.stringify(json))

  let refs = getExternalSchemaPaths(json)
  const returnedSchemas = {}
  const unresolvedRefs = []

  while (refs.length > 0) {
    for (let i=0; i<refs.length; i++) {
      let path = refs[i]      
      const ref = getPathOr(null, path, json)
      path.pop() // drop ref
      let resolvedSchema = getExternalPath(ref, schemas, false)
      
      if (!resolvedSchema) {
        // rename it so the while loop ends
        throw "Unresolved schema: " + ref
      }
      // replace the ref so we can recursively grab more refs if needed...
      else if (path.length) {
        returnedSchemas[ref] = JSON.parse(JSON.stringify(resolvedSchema))
        // use a copy, so we don't pollute the returned schemas
        json = setPath(path, JSON.parse(JSON.stringify(resolvedSchema)), json)
      }
      else {
        delete json['$ref']
        Object.assign(json, resolvedSchema)
      }
    }
    refs = getExternalSchemaPaths(json)
  }

  return returnedSchemas
}

const hasTitle = (def, schema, schemas = {}) => {
  def = localizeDependencies(def, schema, schemas)
  return (true && def.title)
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
  getExternalMarkdownPaths,
  getSchema,
  getSchemaConstraints,
  getExternalSchemas,
  getExternalSchemaPaths,
  getPath,
  getExternalPath,
  hasTitle,
  isDefinitionReferencedBySchema,
  isNull,
  localizeDependencies,
  replaceUri,
  replaceRef,
  flattenSchemas
}