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
import { recursiveFileDirectoryList, isFile, loadVersion, logSuccess, logHeader } from '../shared/helpers.mjs'
import { getModuleContent, getAllModules, addModule } from '../shared/modules.mjs'
import { getSchemaContent, getExternalSchemas, addSchema } from '../shared/json-schema.mjs'
import { setVersion, mergeMethods, setOutput, writeCSV } from './merge/index.mjs'
import path from 'path'
import url from 'url'
import { loadMarkdownContent } from '../shared/descriptions.mjs'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg,
  output: outputArg
}) => {
  // Important file/directory locations
  const versionJson = path.join('package.json')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')
  const output = path.join(outputArg)
  const getAllModulesStream = _ => h(getAllModules())
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
  /************************************************************************************************/
  /******************************************** MAIN **********************************************/
  /************************************************************************************************/

  logHeader(` Creating CSV: ${output}`)

  // pass the output path to the merge module
  setOutput(output)

  // Load the external descriptions
  recursiveFileDirectoryList(markdownFolder).flatFilter(isFile)
    .through(loadMarkdownContent)
    .collect()
    // Load all of the Firebolt OpenRPC modules
    .flatMap(_ => recursiveFileDirectoryList(modulesFolder))
    .through(getModuleContent)
    .sortBy(alphabeticalSorter)
    .tap(addModule)
    .collect()
    // Load the version.json file
    .flatMap(_ => loadVersion(versionJson))
    .tap(setVersion)
    // Iterate through all modules
    .flatMap(_ => getAllModulesStream())
    // Merge stuff from each module
    .tap(mergeMethods)
    // Get any external schemas the module needs
    .map(getExternalSchemas)
    .collect()
    // Write it all to the output file
    .flatMap(writeCSV)
    .done(() => {
        logSuccess('Generated CSV w/ Firebolt APIs.')
    })
}

export default run