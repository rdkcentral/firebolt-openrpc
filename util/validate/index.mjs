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
import { recursiveFileDirectoryList, isFile, logSuccess, logHeader } from '../shared/helpers.mjs'
import { validateJsonSchema, validateOpenRpc } from './validation/index.mjs'
import { generatePropertyEvents, generatePropertySetters, generatePolymorphicPullEvents } from '../shared/modules.mjs'
import { addSchema } from '../shared/json-schema.mjs'
import path from 'path'
import process from 'process'

// Workaround for using __dirname in ESM
import url from 'url'
import { getAllSchemas } from '../shared/json-schema.mjs'
import { homedir } from 'os'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/

let errors = 0
const descriptions = {}

// destructure well-known cli args and alias to variables expected by script
const run = ({
  'shared-schemas': sharedSchemasFolderArg,
  source: srcFolderArg,
  'disable-transforms': disableTransforms // UNDOCUMENTED ARGUMENT!
}) => {
  logHeader(` VALIDATING... `)

  // Important file/directory locations
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const externalFolder = path.join(__dirname, '..', '..', 'src', 'external')
  const modulesFolder = path.join(srcFolderArg, 'modules')

  // Flip default value when running on /dist/ folder
  if (disableTransforms === undefined && srcFolderArg.indexOf('/dist/') >= 0) {
    disableTransforms = true
  }
  
  const validate = (json, validator, prefix) => h(validator(json))
          .tap(result => {
            if (result.valid) {
              logSuccess( prefix + `: ${result.title} is valid`)
            }
            else {
              console.error(`\nERROR: ${prefix}: ${result.title} failed validation`)
              errors ++
            }
          })

  const report = _ => {
    if (errors > 0) {
      console.error(`\nValidation failed with errors in ${errors} files`)
      process.exit(1000)
    }
  }

  // special case for single file (don't do any transforms)
  if (path.extname(srcFolderArg) === '.json') {
    h.of(srcFolderArg)
      .through(getSchemaContent)
      // Side effects previously performed somewhere after getSchemaContent
      .map(addExternalMarkdown(descriptions))
      .flatMap(json => validate(json, validateOpenRpc, 'OpenRPC'))
      .tap(_ => console.log(''))
      .done(report)

    return
  }

  // otherwise do the entire project

  // Load all of the shared JSON-Schemas
  recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile)
    .through(getSchemaContent)
    .errors( (err, push) => {
      errors ++
    })
    .tap(addSchema)
    .collect()
    // Load & validate all of the local JSON-Schemas
    .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    .errors( (err, push) => {
      errors ++
    })
    .tap(addSchema)
    .collect()
    // Switch to external schemas
    .flatMap(_ => recursiveFileDirectoryList(externalFolder))
    .through(getSchemaContent)
    .errors( (err, push) => {
      errors ++
    })
    .tap(addSchema)
    .collect()
    .flatMap( _ => h(getAllSchemas()))
    .flatMap(json => validate(json, validateJsonSchema, 'Schema'))
    .errors( (error, push) => {
      console.log(error)
    })
    .collect()
    // Switch to OpenRPC modules
    .flatMap(_ => recursiveFileDirectoryList(modulesFolder))
    .through(getSchemaContent)
    // Side effects previously performed somewhere after getSchemaContent
    .map(addExternalMarkdown(descriptions))
    .flatMap(x => {
      if (disableTransforms === true) {
        return h.of(x)
      } else {
        return h.of(x)
          .map(generatePropertyEvents)
          .map(generatePropertySetters)
          .map(generatePolymorphicPullEvents)
      }
    })
    .errors( (err, push) => {
      errors ++ // sad panda emoji
    })
    .flatMap(json => validate(json, validateOpenRpc, 'Module'))
    .errors( (error, push) => {
      console.log(error)
    })
    .done(report)
}

export default run
