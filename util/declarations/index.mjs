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
import { recursiveFileDirectoryList, fsWriteFile, isFile, logSuccess } from '../shared/helpers.mjs'
import { generateDeclarations } from './generator/index.mjs'
import { getModuleContent, addModule } from '../shared/modules.mjs'
import path from 'path'
import { getSchemaContent, addSchema, localizeDependencies } from '../shared/json-schema.mjs'

// Workaround for using __dirname in ESM
import url from 'url'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// Load all modules
//todo add version
  // .flatMap(_ => loadVersion(versionJson))
  // .tap(setVersion)
  // .tap(v => console.log(`\nVERSION ${v.major}.${v.minor}.${v.patch}`))
  // .collect()
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg,
  output: outputFile
}) => {
  // Important file/directory locations
  const declarationsFile = path.join(outputFile)
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const sharedSchemasFolder = path.join(__dirname, '..', '..', 'node_modules', '@firebolt-js', 'schemas', 'src', 'schemas')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const hasPublicMethods = json => json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0

  recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile)
    .through(getSchemaContent)
    .tap(addSchema)
    .collect()
    .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    .tap(addSchema)
    .collect()
    .tap(_ => logSuccess('Loaded JSON-Schemas'))
    .flatMap(_ => recursiveFileDirectoryList(modulesFolder).flatFilter(isFile))
    .through(getModuleContent)
    .filter(hasPublicMethods)
    .sortBy(alphabeticalSorter)
    .tap(addModule)
    // Here's where the actual code generation takes place.
    .map(generateDeclarations)
    .collect()
    .map( array => array.join('\n'))
    .flatMap(data => fsWriteFile(declarationsFile, data))
    .collect()
    .tap(_ => logSuccess('Generated declarations: ./dist/firebolt.d.ts'))
    // Load the version.json file
    .done(() => console.log('\nThis has been a presentation of Firebolt OS'))
}

export default run
