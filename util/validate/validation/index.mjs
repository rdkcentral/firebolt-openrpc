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
import { localizeDependencies } from '../../shared/json-schema.mjs'
import crocks from 'crocks'
import groupBy from 'array.prototype.groupby'

const { getPathOr } = crocks

import util from 'util'

const addPrettyPath = (error, json) => {
  const path = []
  const root = json.title || json.info.title

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
  error.prettyPath = '/' + path.join('/')
  error.document = root
  return error
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

  if (error.value) {
    console.error(`\t\x1b[2m${pad('value:')}\x1b[0m\n`)
    console.dir(error.value, {depth: null, colors: true})// + JSON.stringify(example, null, '  ') + '\n')
  }

  console.error()
}

export const validate = (json = {}, schemas = {}, ajvPackage = [], additionalPackages = []) => {
  const [validator, _] = ajvPackage
  let valid = validator(json)
  let root = json.title || json.info.title
  const errors = []

  if (valid) {
    if (json.definitions) {
      const keys = Object.keys(json.definitions)
      for (let i=0; i<keys.length; i++) {
        let key = keys[i]
        const definition = localizeDependencies(getPathOr({}, ['definitions', key], json), json, schemas)
        if (Array.isArray(definition.examples)) {
          const exampleResult = validateExamples(definition, root, ajvPackage, `/definitions/${key}/examples`, ``, json)
          valid = valid && exampleResult.valid
          if (!exampleResult.valid) {
            errors.push(...exampleResult.errors)
          }
        }
      }
    }
    else if (json.methods) {

      additionalPackages.forEach((addtnlValidator) => {
        const additionalValid = addtnlValidator(json)
        if (!additionalValid) {
          valid = false
          addtnlValidator.errors.forEach(error => addPrettyPath(error, json))
          addtnlValidator.errors.forEach(error => error.source = 'Firebolt OpenRPC')
          errors.push(...pruneErrors(addtnlValidator.errors))
        }
      })

      for (let i=0; i<json.methods.length; i++) {
        let method = localizeDependencies(json.methods[i], json)
        try {
          if (method.examples) {
            const result = localizeDependencies(method.result.schema, json, schemas)
            let examples = method.examples.map( ex => ex.result.value)
            if (Array.isArray(examples)) {
              // validate each param schema/examples
              if (method.params && method.params.length) {
                for (let j=0; j<method.params.length; j++) {
                  const p = method.params[j]
                  const param = localizeDependencies(p.schema, json, schemas)
                  param.title = method.name + ' param \'' + p.name + '\''
                  param.examples = method.examples.map(ex => (ex.params.find(x => x.name === p.name) || { value: null }).value)
                  const exampleParamsResult = validateExamples(param, root, ajvPackage, `/methods/${i}/examples`, `/params/${j}`, json)
                  valid = valid && exampleParamsResult.valid
                  if (!exampleParamsResult.valid) {
                    errors.push(...exampleParamsResult.errors)
                  }
                }
              }
              // validate result schema/examples
              result.title = method.name + ' result'
              result.examples = examples
              const exampleResult = validateExamples(result, root, ajvPackage, `/methods/${i}/examples`, `/result`, json)
              valid = valid && exampleResult.valid
              if (!exampleResult.valid) {
                errors.push(...exampleResult.errors)
              }
            }
          }
          else if (method.name !== 'rpc.discover') {
            valid = false
            errors.push(addPrettyPath({
              instancePath: `/methods/${i}/examples`,
              prettyPath: `/methods/${method.name}/examples`,
              document: root,
              message: 'must have at least one example...'
            }, json))
          }
        }
        catch (e) {
          throw e
        }
      }
    }
  }
  else {
    validator.errors.forEach(error => addPrettyPath(error, json))
    validator.errors.forEach(error => error.source = 'OpenRPC')

    errors.push(...pruneErrors(validator.errors))
  } 

  return { valid: valid, title: json.title || json.info.title, errors: errors }
}

const validateExamples = (schema, root, ajvPackage = [], prefix = '', postfix = '', json) => {
  const [validator, ajv] = ajvPackage
  let valid = true
  const errors = []
  let localValidator

  try {
    localValidator = ajv.compile(schema)

    let index = 0
    schema.examples.forEach(example => {
      if (example && !localValidator(example)) {
        valid = false
        localValidator.errors.forEach(error => {
          error.value = example
          error.instancePath = prefix + `/${index}` + postfix + error.instancePath
          error = addPrettyPath(error, json)
          error.source = "Examples"
        })

        errors.push(...pruneErrors(localValidator.errors))
      }
      index++
    })

    if (schema.examples.length === 0) {
      valid = false
      errors.push(addPrettyPath({
        instancePath: `${prefix}`,
        document: root,
        message: 'must have at least one example'
      }, json))
    }
  }
  catch (err) {
    valid = false
    errors.push({
      document: root,
      message: err.message,
      source: 'ajv',
    })
  }

  return { valid: valid, errors: errors }
}