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

import h from 'highland'
import { logSuccess, logHeader, schemaFetcher, combineStreamObjects, localModules, bufferToString, fsReadFile } from '../shared/helpers.mjs'
import { validate } from './validation/index.mjs'
import path from 'path'
import https from 'https'

// Workaround for using __dirname in ESM
import url from 'url'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import { flattenSchemas } from '../shared/json-schema.mjs'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/

// destructure well-known cli args and alias to variables expected by script
const run = ({
  'shared-schemas': sharedSchemasFolderArg,
  source: srcFolderArg,
  'disable-transforms': disableTransforms = false // UNDOCUMENTED ARGUMENT!
}) => {
  logHeader(` VALIDATING... `)

  // Important file/directory locations
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const externalFolder = path.join(__dirname, '..', '..', 'src', 'external')
  const modulesFolder = path.join(srcFolderArg, 'modules')

  // Flip default value when running on /dist/ folder (makes default smart)
  if (!disableTransforms && srcFolderArg.indexOf('/dist/') >= 0) {
    disableTransforms = true
  }

  // Set up the ajv instance
  const ajv = new Ajv()
  addFormats(ajv)
  const errorCounter = 0

  const combinedSchemas = combineStreamObjects(schemaFetcher(sharedSchemasFolder), schemaFetcher(schemasFolder), schemaFetcher(externalFolder))
  const allModules = localModules(modulesFolder, '', disableTransforms)
  
  const getJsonFromUrl = url => h((push) => {
    https.get(url, res => {
      res.on('data', chunk => push(null, chunk))
      res.on('end', () => push(null, h.nil))
    })
  })
  .collect()
  .map(Buffer.concat)
  .map(bufferToString)
  .map(JSON.parse)
  .errors(err => {
    console.error('getJsonFromUrl error')
    console.error(err)
    console.error('Unable to continue')
    process.exit(1)
  })
  
  const jsonSchema = getJsonFromUrl('https://meta.json-schema.tools')
  
  // flatten JSON-Schema into OpenRPC
  //  - OpenRPC uses `additionalItems` when `items` is not an array of schemas. This fails strict validate, so we remove it
  //  - AJV can't seem to handle having a property's schema be the entire JSON-Schema spec, so we need to merge OpenRPC & JSON-Schema into one schema
  const openRpc = jsSpec => getJsonFromUrl('https://meta.open-rpc.org')
    .map(orSpec => {
      flattenSchemas(orSpec, jsSpec) // This is mutating by reference. Only mutates `orSpec`.
      delete orSpec.$schema
      return orSpec
    })

  const printResult = (result, moduleType) => {
    if (result.valid) {
      logSuccess(`${moduleType}: ${result.title} is valid`)
    } else {
      errorCounter++
      console.error(result)
      console.error(`\nERROR, ${moduleType}: ${result.title} failed validation. There are ${errorCounter} other errors`)
    }
  }

  const ajvPackage = (ajv, spec) => [ajv.compile(spec), ajv] // tupling it up for convenience. downstream code needs the instance reference.

  const validateSchemas = ajv => (schemas = {}) => h(Object.values(schemas))
    .map(module => validate(module, schemas, ajv))
    .tap(result => printResult(result, 'Schema'))
  
  const validateModules = ajv => (schemas = {}) => allModules
    .map(Object.values).flatten()
    .map(module => validate(module, schemas, ajv))
    .tap(result => printResult(result, 'Module'))
  
  const validateSingleDocument = ajv => (schemas = {}) => document => fsReadFile(document)
    .map(bufferToString)
    .map(JSON.parse)
    .map(module => validate(module, schemas, ajv, false))
    .tap(result => printResult(result, 'OpenRPC'))

  // If it's a single json file
  if (path.extname(srcFolderArg) === '.json') {
    return jsonSchema
      .flatMap(jsonSchemaSpec => {
        ajvPackage(ajv, jsonSchemaSpec) // Need to call this here for openrpc validation to work
        return combinedSchemas.flatMap(schemas => openRpc(jsonSchemaSpec)
          .flatMap(orSpec => validateSingleDocument(ajvPackage(ajv, orSpec))(schemas)(srcFolderArg)))
      })
  }

  // Run schema validation, then module validation.
  return jsonSchema
    .flatMap(jsonSchemaSpec => h.of(validateSchemas(ajvPackage(ajv, jsonSchemaSpec)))
      .flatMap(fn => combinedSchemas
        .flatMap(schemas => fn(schemas) // Schema validation occurs here, then...
          .concat(openRpc(jsonSchemaSpec)
            .flatMap(orSpec => validateModules(ajvPackage(ajv, orSpec))(schemas))))))
}

export default run
