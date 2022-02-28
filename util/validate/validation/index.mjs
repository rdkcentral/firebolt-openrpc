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
const { getPathOr } = crocks

export const validate = (json = {}, schemas = {}, ajvPackage = []) => {
  const [validator, _] = ajvPackage
  let valid = validator(json)
  let root = json.title || json.info.title

  if (valid) {
    if (json.definitions) {
      const keys = Object.keys(json.definitions)
      for (let i=0; i<keys.length; i++) {
        let key = keys[i]
        const definition = JSON.parse(JSON.stringify(getPathOr({}, ['definitions', key], json)))
        if (Array.isArray(definition.examples)) {
          localizeDependencies(definition, json, schemas)
          valid = valid && validateExamples(definition, root, ajvPackage)
        }
      }
    }
    else if (json.methods) {
      for (let i=0; i<json.methods.length; i++) {
        let method = json.methods[i]
        try {
          if (method.examples) {
            const result = JSON.parse(JSON.stringify(method.result.schema))
            let examples = method.examples.map( ex => ex.result.value)
            if (Array.isArray(examples)) {
              // validate each param schema/examples
              if (method.params && method.params.length) {
                for (let j=0; j<method.params.length; j++) {
                  const p = method.params[j]
                  const param = JSON.parse(JSON.stringify(p.schema))
                  localizeDependencies(param, json, schemas)
                  param.title = method.name + ' param \'' + p.name + '\''
                  param.examples = method.examples.map(ex => (ex.params.find(x => x.name === p.name) || { value: null }).value)
                  valid = valid && validateExamples(param, root, ajvPackage)
                }
              }

              // validate result schema/examples
              localizeDependencies(result, json, schemas)
              result.title = method.name + ' result'
              result.examples = examples
              valid = valid && validateExamples(result, root, ajvPackage)
            }
          }
        }
        catch (e) {
          console.log('ERROR: ' + e)
          console.dir(method.result.schema)
        }
      }
    }
  }
  else {
    validator.errors.forEach(error => {
      const path = []
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
    })
    console.dir(validator.errors, {depth: null, colors: true})
  } 

  return { valid: valid, title: json.title || json.info.title }
}

const validateExamples = (schema, root, ajvPackage = []) => {
  const [validator, ajv] = ajvPackage
  let valid = true

  try {
    const localValidator = ajv.compile(schema)

    let index = 0
    schema.examples.forEach(example => {
      if (example && !localValidator(example)) {
        valid = false
        console.error(`${root} - ${schema.title} example ${index} failed!`)
        console.log('\n')
        console.dir(example, {depth: null, colors: true})// + JSON.stringify(example, null, '  ') + '\n')
        console.log('\n')
        console.dir(localValidator.errors, {depth: null, colors: true})
        console.log('\n')
      }
      index++
    })
  }
  catch (err) {
    valid = false
    console.error(`\n${err.message}\n`)
  }

  if (schema.examples.length === 0) {
    console.log(`\nWARNING: Schema ${schema.title} has no examples!\n`)
  }

  return valid
}