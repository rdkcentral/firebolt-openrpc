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
import { setTemplate, setVersion, mergeSchemas, mergeMethods, updateSchemaUris, setOutput, writeOpenRPC } from './merge/index.mjs'
import path from 'path'
import url from 'url'
import { loadMarkdownContent } from '../shared/descriptions.mjs'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg,
  template: templateArg,
  'shared-schemas': sharedSchemasFolderArg,
  output: outputArg
}) => {
  // Important file/directory locations
  const versionJson = path.join('package.json')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')
  const template = path.join(templateArg)
  const output = path.join(outputArg)
  const getAllModulesStream = _ => h(getAllModules())
  const renameMethods = module => module.methods && (module.methods.forEach(method => method.name = module.info.title + '.' + method.name))
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
  /************************************************************************************************/
  /******************************************** MAIN **********************************************/
  /************************************************************************************************/

  logHeader(` MERGING into: ${output}`)

  // pass the output path to the merge module
  setOutput(output)

  // Load the OpenRPC template.json file
  h.of(template)
    .through(getSchemaContent)
    .tap(setTemplate)
    // Load all of the external markdown resources
    .flatMap(_ => recursiveFileDirectoryList(markdownFolder).flatFilter(isFile))
    .through(loadMarkdownContent)
    .collect()
    // Load all of the global Firebolt JSON-Schemas
    .flatMap(_ => recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    .tap(addSchema)
    .collect()
    // Load all of the project Firebolt JSON-Schemas
    .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    .tap(addSchema)
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
    // rename all methods to <module>.<method.name>
    .tap(renameMethods)
    // Merge stuff from each module
    .tap(mergeMethods)
    .tap(mergeSchemas)
    // Get any external schemas the module needs
    .map(getExternalSchemas)
    // And merge them, too (Note: JSON-Schema's don't have them in the same place, so we're mocking an openrpc-like structure here...)
    .tap(schemas => mergeSchemas( { components: { schemas: schemas } } ))
    // Update the URIs to point to the new localized schemas
    .map(updateSchemaUris)
    .collect()
    // Write it all to the output file
    .flatMap(writeOpenRPC)
    .done(() => {
        logSuccess('Generated Firebolt OpenRPC document\n')
    })
}

export default run