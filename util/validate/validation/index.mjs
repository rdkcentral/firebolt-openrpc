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

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import https from 'https'
import { flattenSchemas, localizeDependencies, replaceUri } from '../../shared/json-schema.mjs'
import crocks from 'crocks'
const { setPath, getPathOr } = crocks

const getJSON = url => new Promise((resolve, reject) => {
  https.get(url, resp => {
    let data = '';

    // A chunk of data has been received.
    resp.on('data', chunk => {
      data += chunk;
    });
  
    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      resolve(JSON.parse(data))
    });    
  }).on('error', err => {
    reject(err.message)
  })
})

const ajv = new Ajv()
addFormats(ajv)

const openrpc = await getJSON('https://meta.open-rpc.org')
const jsonschema = await getJSON('https://meta.json-schema.tools')

// compile jsonSchemaValidator before mucking with it
const jsonSchemaValidator = ajv.compile(jsonschema)

// flatten JSON-Schema into OprnRPC
//  - OpenRPC uses `additionalItems` when `items` is not an array of schemas. This fails strict validate, so we remove it
//  - AJV can't seem to handle having a property's schema be the entire JSON-Schema spec, so we need to merge OpenRPC & JSON-Schema into one schema
flattenSchemas(openrpc, jsonschema)
delete openrpc['$schema']


const openRpcValidator = ajv.compile(openrpc)

export const validateJsonSchema = async json => await validate(json, jsonSchemaValidator)
export const validateOpenRpc = async json => await validate(json, openRpcValidator)

let root

const validate = async (json, validator) => {
  let valid = validator(json)
  root = json.title || json.info.title

  if (valid) {
    if (json.definitions) {
      const keys = Object.keys(json.definitions)
      for (let i=0; i<keys.length; i++) {
        let key = keys[i]
        const definition = JSON.parse(JSON.stringify(getPathOr({}, ['definitions', key], json)))
        if (Array.isArray(definition.examples)) {
          await localizeDependencies(definition, json)
          valid = valid && validateExamples(definition)
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
                  await localizeDependencies(param, json)
                  param.title = method.name + ' param \'' + p.name + '\''
                  param.examples = method.examples.map(ex => (ex.params.find(x => x.name === p.name) || { value: null }).value)
                  valid = valid && validateExamples(param)
                }
              }

              // validate result schema/examples
              await localizeDependencies(result, json)
              result.title = method.name + ' result'
              result.examples = examples
              valid = valid && validateExamples(result)
            }
          }
        }
        catch (e) {
          console.log('ERROR: ' + e)
          console.log(method.result.schema)
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
    console.log(validator.errors)
  }

  return { valid: valid, title: json.title || json.info.title }
}

const validateExamples = schema => {
  let valid = true

  try {
    const validator = ajv.compile(schema)

    let index = 0
    schema.examples.forEach(example => {
      if (example && !validator(example)) {
        valid = false
        console.error(`${root} - ${schema.title} example ${index} failed!`)
        console.log('\n')
        console.dir(example, {depth: null, colors: true})// + JSON.stringify(example, null, '  ') + '\n')
        console.log('\n')
        console.dir(validator.errors, {depth: null, colors: true})
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