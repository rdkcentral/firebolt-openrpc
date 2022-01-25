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
import { recursiveFileDirectoryList, isDirectory, isFile, logSuccess, logHeader } from '../shared/helpers.mjs'
import { validateJsonSchema, validateOpenRpc } from './validation/index.mjs'
import { getModuleContent } from '../shared/modules.mjs'
import { getSchemaContent, addSchema } from '../shared/json-schema.mjs'
import path from 'path'
import process from 'process'

// Workaround for using __dirname in ESM
import url from 'url'
import { getAllSchemas } from '../shared/json-schema.mjs'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/

let errors = 0
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg
}) => {
  logHeader(` VALIDATING... `)

  // Important file/directory locations
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const sharedSchemasFolder = path.join(__dirname, '..', '..', 'src', 'schemas')
  const externalFolder = path.join(__dirname, '..', '..', 'src', 'external')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  
  if (path.extname(srcFolderArg) === '.json') {
    h.of(srcFolderArg)
      .through(getSchemaContent)
      .flatMap(x => {return h(validateJsonSchema(x))})
      .tap(result => {
        if (result.valid) {
          logSuccess(`OpenRPC: ${result.title} is valid`)
        }
        else {
          console.error(`\nERROR: ${result.title} failed validation`)
          errors ++
        }
      })
      .done(() => {
        if (errors > 0) {
          console.error(`\nValidation failed with errors in ${errors} files`)
          process.exit(1000)
        }
      })
  }
  else {
    // Load all of the JSON-Schemas
    recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile)
      .through(getSchemaContent)
      .tap(addSchema)
      .collect()
      .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
      .through(getSchemaContent)
      .tap(addSchema)
      .collect()
      // Validate all of the JSON-Schemas
      .flatMap(_ => h(getAllSchemas()))
      .flatMap(x => {return h(validateJsonSchema(x))})
      .tap(result => {
        if (result.valid) {
          logSuccess(`Schema: ${result.title} is valid`)
        }
        else {
          console.error(`\nERROR: ${result.title} failed validation`)
          errors ++
        }
      })
      .collect()
      // Switch to external schemas
      .flatMap(_ => recursiveFileDirectoryList(externalFolder))
      .through(getSchemaContent)
      .tap(addSchema)
      .flatMap(x => {return h(validateJsonSchema(x))})
      .tap(result => {
        if (result) {
          logSuccess(`Schema: ${result.title} is valid`)
        }
        else {
          console.error(`\nERROR: ${result.title} failed validation`)
          errors ++
        }
      })
      .collect()
      // Switch to OpenRPC modules
      .flatMap(_ => recursiveFileDirectoryList(modulesFolder))
      .through(getModuleContent)
      .errors( (error, push) => {
        console.log(error)
      })
      .flatMap(x => {return h(validateOpenRpc(x))})
      .tap(result => {
        if (result.valid) {
          logSuccess(`Module: ${result.title} is valid`)
        }
        else {
          console.error(`\nERROR: ${result.title} failed validation`)
          errors ++
        }
      })
      .collect()
      .done(() => {
        if (errors > 0) {
          console.error(`\nValidation failed with errors in ${errors} files`)
          process.exit(1000)
        }
      })
  }
}

export default run
