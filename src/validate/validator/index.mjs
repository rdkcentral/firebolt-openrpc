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
import groupBy from 'array.prototype.groupby'
import util from 'util'
import { getPayloadFromEvent } from '../../shared/modules.mjs'
import { getPropertiesInSchema, getPropertySchema } from '../../shared/json-schema.mjs'
import { getCapability, getRole } from '../../shared/methods.mjs'

const addPrettyPath = (error, json, info) => {
  const path = []
  const root = json.title || json.info?.title || info?.title || `Unknown`

  let pointer = json
  error.instancePath.substr(1).split('/').forEach(x => {
    if (x.match(/^[0-9]+$/)) {
      path.push(pointer[parseInt(x)].name || pointer[parseInt(x)].title || x)
      pointer = pointer[parseInt(x)]
    }
    else {
      path.push(x)
      pointer = pointer[x]
    }
  })

  error.instancePath = (info.path ? info.path : '') + error.instancePath
  error.prettyPath = (info.path ? info.path : '') + '/' + path.join('/')
  error.document = root
  error.node = pointer
  return error
}

const addFailingMethodSchema = (error, json, schema) => {
  if (error.instancePath.match(/\/methods\/[0-9]+/)) {
    if (error.keyword == 'if') {
      if (error.params && error.params.failingKeyword == 'then') {
        const i = parseInt(error.schemaPath.split("/")[2])
        error.params.failingSchema = schema.definitions.Method.allOf[i].then.$ref
      }

    }
  }
}

// this method keeps errors that are deeper in the JSON structure, and hides "parent" errors with an overlapping path
export const pruneErrors = (errors = []) => {

  const groups = groupBy(errors, ({ instancePath }) => instancePath )
  const pruned = []

  Object.values(groups).forEach( group => {
    const paths = []
    pruned.push(group.sort( (a, b) => b.schemaPath.split('/').length - a.schemaPath.split('/').length ).pop())
  })

  return pruned
  //const pruned = []
  const paths = []

  if (errors) {
    return errors.filter((value, index, array) => {
      if ((paths.length === 0) || (!paths.find(path => path.startsWith(value.instancePath)))) {
        pruned.push(value)
        paths.push(value.instancePath)
        return true
      }
      return false
    })
  }
  else return errors
}

// this method outputs a much more readable error than the raw JSON
export const displayError = (error) => {
  let errorLocation
  let errorLocationType
  let errorFileType

  if (!error.instancePath) {
    errorLocation = '/'
    errorLocationType = `json`
    errorFileType = `???`
  }
  else if (error.instancePath.startsWith('/components/schemas/')) {
    errorLocation = error.instancePath.split('/').slice(3, 4).join('/')
    errorLocationType = 'schema'
    errorFileType = 'OpenRPC'
  }
  else if (error.instancePath.startsWith('/definitions/')) {
    errorLocation = error.instancePath.split('/').slice(2, 3).join('/')
    errorLocationType = 'schema'
    errorFileType = 'JSON-Schema'
  }
  else if (error.instancePath.startsWith('/methods/')) {
    errorLocation = error.prettyPath.split('/').slice(2, 3).join('/')
    errorLocationType = 'method'
    errorFileType = 'OpenRPC'
  }

  const pad = str => str + ' '.repeat(Math.max(0, 20 - str.length))

  // hard to read this code, but these color escape codes make the errors glorious! :)
  console.error(`Error in ${errorLocationType} '\x1b[32m${errorLocation}\x1b[0m'\n`)
  console.error(`\t\x1b[2m${pad('path:')}\x1b[0m${error.instancePath}`)
  console.error(`\t\x1b[2m${pad('message:')}\x1b[0m\x1b[38;5;2m${error.message}\x1b[0m`)
  console.error(`\t\x1b[2m${pad('schema:')}\x1b[0m\x1b[38;5;2m${error.schemaPath}\x1b[0m`)
  if (error.params) {
    Object.keys(error.params).forEach(key => {
      const param = util.inspect(error.params[key], { colors: true, breakLength: Infinity })
      console.error(`\t\x1b[2m${pad(key+':')}\x1b[0m\x1b[38;5;2m${param}\x1b[0m`)
    })
  }
  if (error.propertyName) {
    console.error(`\t\x1b[2m${pad('property:')}\x1b[0m\x1b[38;5;208m${error.propertyName}\x1b[0m`)
  }
  console.error(`\t\x1b[2m${pad('document:')}\x1b[0m\x1b[38;5;208m${error.document}\x1b[0m \x1b[2m(${errorFileType})\x1b[2m\x1b[0m`)
  console.error(`\t\x1b[2m${pad('source:')}\x1b[0m\x1b[38;5;208m${error.source}\x1b[0m`)

  if (error.capability) {
    console.error(`\t\x1b[2m${pad('capability:')}\x1b[0m\x1b[38;5;208m${error.capability}\x1b[0m`)
    console.error(`\t\x1b[2m${pad('role:')}\x1b[0m\x1b[38;5;208m${error.role}\x1b[0m`)
  }

  if (error.value) {
    console.error(`\t\x1b[2m${pad('value:')}\x1b[0m\n`)
    console.dir(error.value, {depth: null, colors: true})// + JSON.stringify(example, null, '  ') + '\n')
  }

  // This is useful for debugging... please leave comment here for quick access :)
  // console.dir(error, {depth: 1000})
  // console.dir(error.node, {depth: 100})

  console.error()
}

export const validate = (json = {}, info = {}, ajv, validator, additionalPackages = []) => {
  let valid = validator(json)
  const errors = []

  if (valid) {
    if (json.methods) {
      additionalPackages.forEach((addtnlValidator) => {
        const additionalValid = addtnlValidator(json)
        if (!additionalValid) {
          valid = false
          addtnlValidator.errors.forEach(error => addPrettyPath(error, json, info))
          addtnlValidator.errors.forEach(error => error.source = 'Firebolt OpenRPC')
          addtnlValidator.errors.forEach(error => addFailingMethodSchema(error, json, addtnlValidator.schema))
          errors.push(...pruneErrors(addtnlValidator.errors))
        }
      })
    }
  }
  else {
    validator.errors.forEach(error => addPrettyPath(error, json, info))
    validator.errors.forEach(error => error.source = 'OpenRPC')

    json.methods && validator.errors.forEach(error => {
      if (error.instancePath.startsWith('/methods/')) {
        const method = json.methods[parseInt(error.instancePath.split('/')[2])]
        error.capability = getCapability(method)
        error.role = getRole(method)
      }
  })

    errors.push(...pruneErrors(validator.errors))
  }

  return { valid: valid, title: json.title || info?.title || json.info?.title, errors: errors }
}

const schemasMatch = (a, b) => {
  if (a == null) {
    return b == null
  }
  if (b == null) {
    return a == null
  }
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  const keysMatch = (aKeys.length == bKeys.length) && aKeys.every(key => bKeys.includes(key))
  if (keysMatch) {
    const typesMatch = aKeys.every(key => typeof a[key] === typeof b[key])
    if (typesMatch) {
      const valuesMatch = aKeys.every(key => typeof a[key] === 'object' || (a[key] === b[key]))
      if (valuesMatch) {
        const objectsMatch = aKeys.every(key => typeof a[key] !== 'object' || schemasMatch(a[key], b[key]))
        if (objectsMatch) {
          return true
        }
      }
    }
  }

  return false
}

export const validatePasshtroughs = (json) => {
  const providees = json.methods.filter(m => m.tags.find(t => t['x-provided-by']))

  const result = {
    valid: true,
    title: 'Mapping of all x-provided-by methods',
    errors: []
  }

  providees.forEach(method => {
    const providerName = method.tags.find(t => t['x-provided-by'])['x-provided-by']
    const provider = json.methods.find(m => m.name === providerName)
    let destination, examples1
    let source, examples2
    let sourceName

    if (!provider) {
      result.errors.push({
        message: `The x-provided-by method '${providerName}' does not exist`,
        instancePath: `/methods/${json.methods.indexOf(method)}`
      })
      return
    }
    else if (method.tags.find(t => t.name === 'event')) {
      destination = getPayloadFromEvent(method)
      examples1 = method.examples.map(e => e.result.value)
      source = provider.params[provider.params.length-1].schema
      sourceName = provider.params[provider.params.length-1].name
      examples2 = provider.examples.map(e => e.params[e.params.length-1].value)
    }
    else {
      // destination = method.result.schema
      // examples1 = method.examples.map(e => e.result.value)
      // source = JSON.parse(JSON.stringify(provider.tags.find(t => t['x-response'])['x-response']))
      // sourceName = provider.tags.find(t => t['x-response'])['x-response-name']
      // examples2 = provider.tags.find(t => t['x-response'])['x-response'].examples
      // delete source.examples
    }

    if (!schemasMatch(source, destination)) {
      const properties = getPropertiesInSchema(destination, json)

      // follow $refs so we can see the schemas
      source = getPropertySchema(source, '.', json)
      destination = getPropertySchema(destination, '.', json)

      if (properties && properties.length && sourceName) {
        let candidate = getPropertySchema(getPropertySchema(destination, `properties.${sourceName}`, json), '.', json)

        if (!candidate) {
          result.errors.push({
            message: `The x-provided-by method '${providerName}' does not have a matching result schema or ${sourceName} property`,
            instancePath: `/methods/${json.methods.indexOf(method)}`
          })
        } else if (!schemasMatch(candidate, source)) {
          result.errors.push({
            message: `The x-provided-by method '${providerName}' does not have a matching result schema or ${sourceName} schema`,
            instancePath: `/methods/${json.methods.indexOf(method)}`
          })
        }
      }
      else if (!sourceName) {
        result.errors.push({
          message: `The x-provided-by method '${providerName}' does not have a matching result schema and has no x-response-name property to inject into`,
          instancePath: `/methods/${json.methods.indexOf(method)}`
        })
      }
      else {
        result.errors.push({
          message: `The x-provided-by method '${providerName}' does not have a matching schema and has not candidate sub-schemas`,
          instancePath: `/methods/${json.methods.indexOf(method)}`
        })
      }
    }
  })
  if (result.errors.length) {
    result.valid = false
    result.errors.forEach(error => addPrettyPath(error, json))
  }

  return result

}
