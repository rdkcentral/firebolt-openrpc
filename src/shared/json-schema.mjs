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

    if (node.propertyNames) {
      props.push(...node.propertyNames)
    }

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

      if (schemaReferencesItself(resolvedSchema, refToPath(ref))) {
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
  const refs = objectPaths(moduleJson)
                .filter(x => /\/\$ref$/.test(x))
                .map(refToPath)
                .map(x => getPathOr(null, x, moduleJson))
                .filter(x => x === name)

  return (refs.length > 0)
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

const getSafeEnumKeyName = function(value, keyPrefix = '') {
  if (keyPrefix != '') {
    value = keyPrefix + '_' + value
  }

  let key = value.split(':').pop()          // use last portion of urn:style:values
    .replace(/\+/g, '_plus')                // change + to _plus
    .replace(/[\.\-\/\;]/g, '_')            // replace special characters
    .replace(/([a-z])([A-Z0-9])/g, '$1_$2') // camel -> snake case
    .replace(/^([0-9]+\_([0-9]+)?)/, 'v$1') // insert `v` in front of things that look like version numbers

  return key.toUpperCase()
}

export {
  getSchemaConstraints,
  getSafeKeyName,
  getSafeEnumKeyName,
  getExternalSchemaPaths,
  getLocalSchemas,
  getLocalSchemaPaths,
  getLinkedSchemaPaths,
  getPath,
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
  dereferenceAndMergeAllOfs
}
