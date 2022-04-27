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

import { fsWriteFile, logSuccess, fsMkDirP, logHeader, combineStreamObjects, schemaFetcher, localModules, trimPath } from '../shared/helpers.mjs'
import { generateDeclarations } from './generator/index.mjs'
import path from 'path'

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source,
  'shared-schemas': sharedSchemasFolderArg,
  output: declarationsFile
}) => {
  // Important file/directory locations
  const declarationsDir = path.dirname(declarationsFile)
  const schemasFolder = path.join(source, 'schemas')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const modulesFolder = path.join(source, 'modules')
  const markdownFolder = path.join(source, 'declarations')
  logHeader(`Generating typescript declarations file: ${declarationsFile}`)
  const combinedSchemas = combineStreamObjects(schemaFetcher(sharedSchemasFolder), schemaFetcher(schemasFolder))
  const allModules = localModules(modulesFolder, markdownFolder) // Default behavior. Transforms and no private modules
  return fsMkDirP(declarationsDir)
    .flatMap(_ => combinedSchemas
      .flatMap(schemas => allModules
        .map(modules => Object.values(modules))
        .flatten()
        .map(module => generateDeclarations(module, schemas))
        .collect()
        .map(xs => {
          const joined = xs.join('\n')
          return joined
        })
        .flatMap(fileContents => {
          return fsWriteFile(declarationsFile, fileContents)
        })
      )
    )
    .tap(_ => {
      const filename = trimPath(declarationsFile)
      logSuccess(`Wrote file: ${filename}`)
    })
}

export default run
