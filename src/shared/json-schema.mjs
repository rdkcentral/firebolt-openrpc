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

const isSchema = element => element.$ref || element.type || element.const || element.oneOf || element.anyOf || element.allOf || element.$id

const pathToArray = (ref, json) => {
  //let path = ref.split('#').pop().substr(1).split('/')

  const ids = []
  if (json) {
    ids.push(...getAllValuesForName("$id", json)) // add all $ids but the first one
  }

  const subschema = ids.find(id => ref.indexOf(id) >= 0)

  let path = ref.split('#').pop().substring(1)

  if (subschema) {
    path = [].concat(...path.split('/'+subschema+'/').map(n => [n.split('/'), subschema])).slice(0, -1).flat()
  }
  else {
    path = path.split('/')
  }

  return path.map(x => x.match(/^[0-9]+$/) ? parseInt(x) : x)
}

const refToPath = ref => {
  let path = ref.split('#').pop().substr(1).split('/')
  return path.map(x => x.match(/^[0-9]+$/) ? parseInt(x) : x)
}

const objectPaths = obj => {
  const isObject = val => typeof val === 'object'
  const addDelimiter = (a, b) => a ? `${a}/${b}` : b;

  const paths = (obj = {}, head = '#') => {
    if (obj && isObject(obj) && obj.$id && head !== '#') {
      head = obj.$id
    }
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

const getAllValuesForName = (name, obj) => {
  const isObject = val => typeof val === 'object'

  const values = (name, obj = {}) => {
    return obj ? Object.entries(obj)
      .reduce((product, [key, value]) => {
        if (isObject(value)) {
          return product.concat(values(name, value))
        }
        else if (key === name) {
          return product.concat(value)
        }
        else {
          return product
        }
      }, []) : [] 
  }
  return [...new Set(values(name, obj))];
}

const getExternalSchemaPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(x => pathToArray(x, obj))
    .filter(x => !/^#/.test(getPathOr(null, x, obj)))
}

const getLocalSchemaPaths = obj => {
  return objectPaths(obj)
    .filter(x => /\/\$ref$/.test(x))
    .map(x => pathToArray(x, obj))
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

const namespaceRefs = (uri, namespace, schema) => {
  if (schema) {
    if (schema.hasOwnProperty('$ref') && (typeof schema['$ref'] === 'string')) {
      const parts = schema.$ref.split('#')
      if (parts[0] === uri && parts[1].indexOf('.') === -1) {
        const old = schema.$ref
        schema['$ref'] = schema['$ref'].split('#').map( x => x === uri ? uri : x.split('/').map((y, i, arr) => i===arr.length-1 ? namespace + '.' + y : y).join('/')).join('#')
      }
    }
    else if (typeof schema === 'object') {
      Object.keys(schema).forEach(key => {
        namespaceRefs(uri, namespace, schema[key])
      })
    }
  }
}

const getReferencedSchema = (uri = '', moduleJson = {}) => {
  const [mainPath, subPath] = (uri || '').split('#')
  let result

  if (!uri) {
    throw "getReferencedSchema requires a non-null uri parameter"
  }

  if (mainPath) {
    // TODO... assuming that bundles are in one of these two places is dangerous, should write a quick method to "find" where they are
    result = getPathOr(null, ['components', 'schemas', mainPath, ...subPath.slice(1).split('/')], moduleJson)
              || getPathOr(null, ['definitions', mainPath, ...subPath.slice(1).split('/')], moduleJson)
  }
  else if (subPath) {
    result = getPathOr(null, subPath.slice(1).split('/'), moduleJson)
  }
  if (!result) {
    //throw `getReferencedSchema: Path '${uri}' not found in ${moduleJson ? (moduleJson.title || moduleJson.info.title) : moduleJson}.`
    return null
  }
  else {
    return result
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

const getPropertySchema = (json, dotPath, document) => {
  const path = dotPath.split('.')
  let node = json

  for (var i=0; i<path.length; i++) {
    const property = path[i]
    const remainingPath = path.filter((x, j) => j >= i ).join('.')
    if (node.$ref) {
      node = getPropertySchema(getPath(node.$ref, document), remainingPath, document)
    }
    else if (property === '') {
      return node
    }
    else if (node.type === 'object' || (node.type && node.type.includes && node.type.includes('object'))) {
      if (node.properties && node.properties[property]) {
        node = node.properties[property]
      }
      // todo: need to escape the regex?
      else if (node.patternProperties && property.match(node.patternProperties)) {
        node = node.patternProperties[property]
      }
      else if (node.additionalProperties && typeof node.additionalProperties === 'object') {
        node = node.additionalProperties
      }
    }
    else if (Array.isArray(node.allOf)) {
      node = node.allOf.find(s => {
        let schema
        try {
          schema = getPropertySchema(s, remainingPath, document)
        }
        catch (error) {

        }
        return schema
      })
    }
    else {
      throw `Cannot get property '${dotPath}' of non-object.`
    }
  }

  return node
}

const getPropertiesInSchema = (json, document) => {
  let node = json

  while (node.$ref) {
    node = getPath(node.$ref, document)
  }

  if (node.type === 'object') {
    const props = []
    if (node.properties) {
      props.push(...Object.keys(node.properties))
    }

    // TODO: this propertyNames requires either additionalProperties or patternProperties in order to use this method w/ getPropertySchema, as intended...
    // if (node.propertyNames) {
    //   props.push(...node.propertyNames)
    // }

    return props
  }
  
  return null
}

function getSchemaConstraints(schema, module, options = { delimiter: '\n' }) {
  if (schema.schema) {
    schema = schema.schema
  }
  const wrap = (str, wrapper) => wrapper + str + wrapper

  if (schema['$ref']) {
    if (schema['$ref'][0] === '#') {
      return getSchemaConstraints(getReferencedSchema(schema['$ref'], module), module, options)
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

/**
 * Deep clones an object to avoid mutating the original.
 * @param {Object} obj - The object to clone.
 * @returns {Object} - The cloned object.
 */
const cloneDeep = (obj) => JSON.parse(JSON.stringify(obj))

/**
 * Dereferences schema paths and resolves references.
 * @param {Array} refs - Array of schema paths to dereference.
 * @param {Object} definition - The schema definition.
 * @param {Object} document - The document containing schemas.
 * @param {Array} unresolvedRefs - Array to collect unresolved references.
 * @param {boolean} [externalOnly=false] - Whether to only dereference external schemas.
 * @param {boolean} [keepRefsAndLocalizeAsComponent=false] - Whether to keep references and localize as components.
 * @returns {Object} - The updated schema definition.
 */
const dereferenceSchema = (refs, definition, document, unresolvedRefs, externalOnly = false, keepRefsAndLocalizeAsComponent = false) => {
  while (refs.length > 0) {
    for (let i = 0; i < refs.length; i++) {
      let path = refs[i]
      const ref = getPathOr(null, path, definition)
      path.pop() // drop ref

      let resolvedSchema = cloneDeep(getPathOr(null, refToPath(ref), document))

      if (schemaReferencesItself(resolvedSchema, pathToArray(ref, document))) {
        resolvedSchema = null
      }

      if (!resolvedSchema) {
        resolvedSchema = { "$REF": ref }
        unresolvedRefs.push([...path])
      }

      if (path.length) {
        const examples = getPathOr(null, [...path, 'examples'], definition)
        resolvedSchema.examples = examples || resolvedSchema.examples

        if (keepRefsAndLocalizeAsComponent) {
          const title = ref.split('/').pop()
          definition.components = definition.components || {}
          definition.components.schemas = definition.components.schemas || {}
          definition.components.schemas[title] = resolvedSchema
          definition = setPath([...path, '$ref'], `#/components/schemas/${title}`, definition)
        } else {
          definition = setPath(path, resolvedSchema, definition)
        }
      } else {
        delete definition['$ref']
        Object.assign(definition, resolvedSchema)
      }
    }
    refs = externalOnly ? getExternalSchemaPaths(definition) : getLocalSchemaPaths(definition)
  }
  return definition
}

const findAndMergeAllOfs = (pointer) => {
  let allOfFound = false;

  const mergeAllOfs = (obj) => {
    if (Array.isArray(obj) && obj.length === 0) {
      return obj;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (key === 'allOf' && Array.isArray(obj[key])) {
          const union = deepmerge.all(obj.allOf.reverse());
          const title = obj.title;
          Object.assign(obj, union);
          if (title) {
            obj.title = title;
          }
          delete obj.allOf;
          allOfFound = true;
        } else if (typeof obj[key] === 'object') {
          mergeAllOfs(obj[key]);
        }
      }
    }
  };

  mergeAllOfs(pointer);
  return allOfFound;
};

/**
 * Dereferences and merges allOf entries in a method schema.
 * @param {Object} method - The method schema to dereference and merge.
 * @param {Object} module - The module containing schemas.
 * @returns {Object} - The dereferenced and merged schema.
 */
const dereferenceAndMergeAllOfs = (method, module) => {
  let definition = cloneDeep(method)
  let unresolvedRefs = []
  const originalDefinition = cloneDeep(definition)

  definition = dereferenceSchema(getLocalSchemaPaths(definition), definition, module, unresolvedRefs)
  definition = dereferenceSchema(getExternalSchemaPaths(definition), definition, module, unresolvedRefs, true)

  const allOfFound = findAndMergeAllOfs(definition)

  if (!allOfFound) {
    return originalDefinition
  }

  unresolvedRefs.forEach((ref) => {
    let node = getPathOr({}, ref, definition)
    node['$ref'] = node['$REF']
    delete node['$REF']
  })

  return definition
}

/**
 * Localizes dependencies in a JSON schema, dereferencing references and optionally merging allOf entries.
 * @param {Object} json - The JSON schema to localize.
 * @param {Object} document - The document containing schemas.
 * @param {Object} [schemas={}] - Additional schemas to use for dereferencing.
 * @param {Object|boolean} [options=defaultLocalizeOptions] - Options for localization, or a boolean for externalOnly.
 * @returns {Object} - The localized schema.
 */
const localizeDependencies = (json, document, schemas = {}, options = defaultLocalizeOptions) => {
  if (typeof options === 'boolean') {
    options = { ...defaultLocalizeOptions, externalOnly: options }
  }

  let definition = cloneDeep(json)
  let unresolvedRefs = []

  if (!options.externalOnly) {
    definition = dereferenceSchema(getLocalSchemaPaths(definition), definition, document, unresolvedRefs)
  }

  definition = dereferenceSchema(getExternalSchemaPaths(definition), definition, document, unresolvedRefs, true, options.keepRefsAndLocalizeAsComponent)

  unresolvedRefs.forEach((ref) => {
    let node = getPathOr({}, ref, definition)
    node['$ref'] = node['$REF']
    delete node['$REF']
  })

  if (options.mergeAllOfs) {
    findAndMergeAllOfs(definition)
  }

  return definition
}

const getLocalSchemas = (json = {}) => {
  return Array.from(new Set(getLocalSchemaPaths(json).map(path => getPathOr(null, path, json))))
}

const isDefinitionReferencedBySchema = (name = '', moduleJson = {}) => {
  let subSchema = false
  if (name.indexOf("/https://") >= 0) {
    name = name.substring(name.indexOf('/https://')+1)
    subSchema = true
  }
  const refs = objectPaths(moduleJson)
                .filter(x => /\/\$ref$/.test(x))
                .map(x => pathToArray(x, moduleJson))
                .map(x => getPathOr(null, x, moduleJson))
                .filter(x => subSchema ? x.startsWith(name) : x === name)

  return (refs.length > 0)
}

const findAll = (document, finder) => {
  const results = []

  if (document && finder(document)) {
    results.push(document)
  }

  if ((typeof document) !== 'object' || !document) {
    return results
  }

  Object.keys(document).forEach(key => {

    if (Array.isArray(document) && key === 'length') {
      return results
    }
    else if (typeof document[key] === 'object') {
      results.push(...findAll(document[key], finder))
    }
  })

  return results
}

const flattenMultipleOfs = (document, type, pointer, path) => {
  if (!pointer) {
    pointer = document
    path = ''
  }

  if ((typeof pointer) !== 'object' || !pointer) {
    return
  }

  if (pointer !== document && schemaReferencesItself(pointer, path.split('.'))) {
    console.warn(`Skipping recursive schema: ${pointer.title}`)
    return
  }

  Object.keys(pointer).forEach(key => {

    if (Array.isArray(pointer) && key === 'length') {
      return
    }
    if ( (pointer.$id && pointer !== document) || ((key !== type) && (typeof pointer[key] === 'object') && (pointer[key] != null))) {
      flattenMultipleOfs(document, type, pointer[key], path + '.' + key)
    }
    else if (key === type && Array.isArray(pointer[key])) {

      try {
        const schemas = pointer[key]
        if (schemas.find(schema => schema.$ref?.endsWith("/ListenResponse"))) {
          // ignore the ListenResponse parent anyOf, but dive into it's sibling
          const sibling = schemas.find(schema => !schema.$ref?.endsWith("/ListenResponse"))
          const n = schemas.indexOf(sibling)
          flattenMultipleOfs(document, type, schemas[n], path + '.' + key + '.' + n)
        }        
        else {
          const title = pointer.title
          let debug = false
          Object.assign(pointer, combineSchemas(pointer[key], document, path, type === 'allOf'))
          if (title) {
            pointer.title = title
          }          
          delete pointer[key]
        }
      }
      catch(error) {
        console.warn(` - Unable to flatten ${type} in ${path}`)
        console.log(error)
      }
    }
  })
}

function combineProperty(result, schema, document, prop, path, all) {
  if (result.properties === undefined || result.properties[prop] === undefined) {
    if (result.additionalProperties === false || schema.additionalProperties === false) {
      if (all) {
        // leave it out
      }
      else {
        result.properties = result.properties || {}
        result.properties[prop] = getPropertySchema(schema, prop, document)
      }
    }
    else if (typeof result.additionalProperties === 'object') {
      result.properties = result.properties || {}
      result.properties[prop] = combineSchemas([result.additionalProperties, getPropertySchema(schema, prop, document)], document, path + '.' + prop, all)
    }
    else {
      result.properties = result.properties || {}
      result.properties[prop] = getPropertySchema(schema, prop, document)
    }
  }
  else if (schema.properties === undefined || schema.properties[prop] === undefined) {
    if (result.additionalProperties === false || schema.additionalProperties === false) {
      if (all) {
        delete result.properties[prop]
      }
      else {
        // leave it
      }
    }
    else if (typeof schema.additionalProperties === 'object') {
      result.properties = result.properties || {}
      result.properties[prop] = combineSchemas([schema.additionalProperties, getPropertySchema(result, prop, document)], document, path + '.' + prop, all)
    }
    else {
      // do nothing
    }    
  }
  else {
    const a = getPropertySchema(result, prop, document)
    const b = getPropertySchema(schema, prop, document)

    result.properties[prop] = combineSchemas([a, b], document, path + '.' + prop, all, true)
  }

  result = JSON.parse(JSON.stringify(result))
}

function combineSchemas(schemas, document, path, all, createRefIfNeeded=false) {
  schemas = JSON.parse(JSON.stringify(schemas))
  let createRefSchema = false

  if (createRefIfNeeded && schemas.find(s => s?.$ref) && !schemas.every(s => s.$ref === schemas.find(s => s?.$ref).$ref)) { 
    createRefSchema = true
  }

  const reference = createRefSchema ? schemas.filter(schema => schema?.$ref).map(schema => schema.$ref).reduce( (prefix, ref, i, arr) => {
    if (prefix === '') {
      if (arr.length === 1) {
        return ref.split('/').slice(0, -1).join('/') + '/'
      }
      else {
        return ref
      }
    }
    else {
      let index = 0
      while ((index < Math.min(prefix.length, ref.length)) && (prefix.charAt(index) === ref.charAt(index))) {
        index++
      }
      return prefix.substring(0, index)
    }
  }, '') : ''

  const resolve = (schema) => {
    while (schema.$ref) {
      if (!getReferencedSchema(schema.$ref, document)) {
        console.log(`getReferencedSChema returned null`)
        console.dir(schema)
      }
      schema = getReferencedSchema(schema.$ref, document)
    }
    return schema
  }

  let debug = false

  const merge = (schema) => {
    if (schema.allOf) {
      schema.allOf = schema.allOf.map(resolve)
      Object.assign(schema, combineSchemas(schema.allOf, document, path, true))
      delete schema.allOf
    }
    if (schema.oneOf) {
      schema.oneOf = schema.oneOf.map(resolve)
      Object.assign(schema, combineSchemas(schema.oneOf, document, path, false))
      delete schema.oneOf
    }
    if (schema.anyOf) {
      schema.anyOf = schema.anyOf.map(resolve)
      Object.assign(schema, combineSchemas(schema.anyOf, document, path, false))
      delete schema.anyOf
    }
    return schema
  }

  const flatten = (schema) => {
    while (schema.$ref || schema.oneOf || schema.anyOf || schema.allOf) {
      schema = resolve(schema)
      schema = merge(schema)
    }
    return schema
  }

  let result = schemas.shift()

  schemas.forEach(schema => {

    if (!schema) {
      return // skip
    }

    if (schema.$ref && (schema.$ref === result.$ref)) {
      return
    }

    result = JSON.parse(JSON.stringify(flatten(result)))
    schema = JSON.parse(JSON.stringify(flatten(schema)))

    if (schema.examples && result.examples) {
      result.examples.push(...schema.examples)
    }

    if (schema.anyOf) {
      throw "Cannot combine schemas that contain anyOf"
    }
    else if (schema.oneOf) {
      throw "Cannot combine schemas that contain oneOf"
    }
    else if (schema.allOf) {
      throw "Cannot combine schemas that contain allOf"
    }
    else if (Array.isArray(schema.type)) {
      throw "Cannot combine schemas that have type set to an Array"
    }
    else {
      if (result.const !== undefined && schema.const != undefined) {
        if (result.const === schema.const) {
          return
        }
        else if (all) {
          throw `Combined allOf resulted in impossible schema: const ${schema.const} !== const ${result.const}`
        }
        else {
          result.enum = [result.const, schema.const]
          result.type = typeof result.const
          delete result.const
        }
      }
      else if (result.enum && schema.enum) {
        if (all) {
          result.enum = result.enum.filter(value => schema.enum.includes(value))
          if (result.enum.length === 0) {
            throw `Combined allOf resulted in impossible schema: enum: []`
          }
        }
        else {
          result.enum = Array.from(new Set(result.enum.concat(schema.enum)))
        }
      }
      else if ((result.const !== undefined || schema.const !== undefined) && (result.enum || schema.enum)) {
        if (all) {
          const c = result.const !== undefined ? result.const : schema.const
          const e = result.enum || schema.enum
          if (e.contains(c)) {
            result.const = c
            delete result.enum
            delete result.type
          }
          else {
            throw `Combined allOf resulted in impossible schema: enum: ${e} does not contain const: ${c}`
          }
        }
        else {
          result.enum = Array.from(new Set([].concat(result.enum || result.const).concat(schema.enum || schema.const)))
          result.type = result.type || schema.type
          delete result.const
        }
      }
      else if ((result.const !== undefined || schema.const !== undefined) && (result.type || schema.type)) {
        // TODO need to make sure the types match
        if (all) {
          result.const = result.const !== undefined ? result.const : schema.const
          delete result.type
        }
        else {
          result.type = result.type || schema.type
          delete result.const
        }
      }
      else if (schema.type !== result.type) {
        throw `Cannot combine schemas with property type conflicts, '${path}': ${schema.type} != ${result.type} in ${schema.title} / ${result.title}`
      }  
      else if ((result.enum || schema.enum) && (result.type || schema.type)) {
        if (all) {
          result.enum = result.enum || schema.enum
        }
        else {
          result.type = result.type || schema.type
          delete result.enum
        }
      }
      else if (schema.type === "object") {
        const propsInSchema = getPropertiesInSchema(schema, document)
        const propsOnlyInResult = getPropertiesInSchema(result, document).filter(p => !propsInSchema.includes(p))

        propsInSchema.forEach(prop => {
          combineProperty(result, schema, document, prop, path, all)
          delete result.title
        })

        propsOnlyInResult.forEach(prop => {
          combineProperty(result, schema, document, prop, path, all)
          delete result.title
        })

        if (result.additionalProperties === false || schema.additionalProperties === false) {
          if (all) {
            result.additionalProperties = false
          }
          else {
            if (result.additionalProperties === true || schema.additionalProperties === true || result.additionalProperties === undefined || schema.additionalProperties === undefined) {
              result.additionalProperties = true
            }
            else if (typeof result.additionalProperties === 'object' || typeof schema.additionalProperties === 'object') {
              result.additionalProperties = result.additionalProperties || schema.additionalProperties
            }
          }
        }
        else if (typeof result.additionalProperties === 'object' || typeof schema.additionalProperties === 'object') {
          result.additionalProperties = combineSchemas([result.additionalProperties, schema.additionalProperties], document, path, all)
        }

        if (Array.isArray(result.propertyNames) && Array.isArray(schema.propertyNames)) {
          if (all) {
            result.propertyNames = Array.from(new Set(result.propertyNames.concat(schema.propertyNames)))
          }
          else {
            result.propertyNames = result.propertyNames.filter(prop => schema.propertyNames.includes(prop))
          }
        }
        else if (Array.isArray(result.propertyNames) || Array.isArray(schema.propertyNames)) {
          if (all) {
            result.propertyNames = result.propertyNames || schema.propertyNames
          }
          else {
            delete result.propertyNames
          }
        }
        
        if (result.patternProperties || schema.patternProperties) {
          throw `Cannot combine object schemas that have patternProperties ${schema.title} / ${result.title}, ${path}`
        }

        if (result.required && schema.required) {
          if (all) {
            result.required = Array.from(new Set(result.required.concat(schema.required)))
          }
          else {
            result.required = result.required.filter(prop => schema.required.includes(prop))
          }
        }
        else if (result.required || schema.required) {
          if (all) {
            result.required = result.required || schema.required
          }
          else {
            delete result.required
          }
        }
      }
      else if (schema.type === "array") {
        if (Array.isArray(result.items) || Array.isArray(schema.items)) {
          throw `Cannot combine tuple schemas, ${path}: ${schema.title} / ${result.title}`
        }
        result.items = combineSchemas([result.items, schema.items], document, path, all)
      }

      if (result.title || schema.title) {
        result.title = schema.title || result.title // prefer titles from lower in the any/all/oneOf list
      }

      // combine all other stuff
      const skip = ['title', 'type', '$ref', 'const', 'enum', 'properties', 'items', 'additionalProperties', 'patternProperties', 'anyOf', 'oneOf', 'allOf']
      const keysInSchema = Object.keys(schema)
      const keysOnlyInResult = Object.keys(result).filter(k => !keysInSchema.includes(k))

      keysInSchema.filter(key => !skip.includes(key)).forEach(key => {
        if (result[key] === undefined) {
          if (all) {
            result[key] = schema[key]
          }
        }
        else {
          // not worth doing this for code-generation, e.g. minimum doesn't actually affect type defintions in most languages
        }
      })

      keysOnlyInResult.filter(key => !skip.includes(key)).forEach(key => {
        if (all) {
          // do nothing
        }
        else {
          delete result[key]
        }
      })
    }
  })

  delete result.if
  delete result.then
  delete result.else
  delete result.not

  if (reference && createRefSchema) {
    const [fragment, uri] = reference.split('#').reverse()
    const title = result.title || path.split('.').slice(-2).map(x => x.charAt(0).toUpperCase() + x.substring(1)).join('')

    result.title = title
    
    let bundle 

    if (uri) {
      bundle = findAll(document, s => s.$id === uri)[0]
    }
    else {
      bundle = document
    }

    let pathArray = (fragment + title).split('/')
    const name = pathArray.pop()
    let key, i=1
    while (key = pathArray[i]) {
      bundle = bundle[key]
      i++
    }

    bundle[name] = result

    const refSchema = {
      $ref: [uri ? uri : '', [...pathArray, name].join('/')].join('#')
    }

    return refSchema
  }
  
  return result
}

function union(schemas) {

  const result = {};
  for (const schema of schemas) {
    for (const [key, value] of Object.entries(schema)) {
      if (!result.hasOwnProperty(key)) {
        // If the key does not already exist in the result schema, add it
        if (value && value.anyOf) {
          result[key] = union(value.anyOf)
        } else if (key === 'title' || key === 'description' || key === 'required') {
          //console.warn(`Ignoring "${key}"`)
        } else {
          result[key] = value;
        }
      } else if (key === '$ref') {
        if (result[key].endsWith("/ListenResponse")) {

        }
        // If the key is '$ref' make sure it's the same
        else if(result[key] === value) {
          //console.warn(`Ignoring "${key}" that is already present and same`)
        } else {
          console.warn(`ERROR "${key}" is not same -${JSON.stringify(result, null, 4)} ${key} ${result[key]} - ${value}`);
          throw "ERROR: $ref is not same"
        }
      } else if (key === 'type') {
        // If the key is 'type', merge the types of the two schemas
        if(result[key] === value) {
          //console.warn(`Ignoring "${key}" that is already present and same`)
        } else {
          console.warn(`ERROR "${key}" is not same -${JSON.stringify(result, null, 4)} ${key} ${result[key]} - ${value}`);
          throw "ERROR: type is not same"
        }
      } else {
        //If the Key is a const then merge them into an enum
        if(value && value.const) {
          if(result[key].enum) {
            result[key].enum = Array.from(new Set([...result[key].enum, value.const]))
          }
          else {
            result[key].enum = Array.from(new Set([result[key].const, value.const]))
            delete result[key].const
          }
        }
        // If the key exists in both schemas and is not 'type', merge the values
        else if (Array.isArray(result[key])) {
          // If the value is an array, concatenate the arrays and remove duplicates
          result[key] = Array.from(new Set([...result[key], ...value]))
        } else if (result[key] && result[key].enum && value && value.enum) {
          //If the value is an enum, merge the enums together and remove duplicates
          result[key].enum = Array.from(new Set([...result[key].enum, ...value.enum]))
        } else if (typeof result[key] === 'object' && typeof value === 'object') {
          // If the value is an object, recursively merge the objects
          result[key] = union([result[key], value]);
        } else if (result[key] !== value) {
          // If the value is a primitive and is not the same in both schemas, ignore it
          //console.warn(`Ignoring conflicting value for key "${key}"`)
        }
      }
    }
  }
  return result;
}

function mergeAnyOf(schema) {
  return union(schema.anyOf)
}

function mergeOneOf(schema) {
  return union(schema.oneOf)
}

const getSafeKeyName = (value) => value.split(':').pop()
                                        .replace(/[\.\-]/g, '_')                       // replace dots and dashes
                                        .replace(/\+/g, '_plus')                       // change + to _plus

const getSafeEnumKeyName = (value) => value.split(':').pop()                           // use last portion of urn:style:values
                                        .replace(/[\.\-]/g, '_')                       // replace dots and dashes
                                        .replace(/\+/g, '_plus')                       // change + to _plus
                                        .replace(/([a-z])([A-Z0-9])/g, '$1_$2')        // camel -> snake case
                                        .replace(/^([0-9]+(\.[0-9]+)?)/, 'v$1')        // insert `v` in front of things that look like version numbers
                                        .toUpperCase()                 

export {
  getSchemaConstraints,
  getSafeKeyName,
  getSafeEnumKeyName,
  getExternalSchemaPaths,
  getLocalSchemas,
  getLocalSchemaPaths,
  getLinkedSchemaPaths,
  getPath,
  getReferencedSchema,
  getPropertySchema,
  getPropertiesInSchema,
  isDefinitionReferencedBySchema,
  isNull,
  isSchema,
  localizeDependencies,
  replaceUri,
  replaceRef,
  removeIgnoredAdditionalItems,
  mergeAnyOf,
  mergeOneOf,
  dereferenceAndMergeAllOfs,
  flattenMultipleOfs,
  namespaceRefs,
  getAllValuesForName,
} 
