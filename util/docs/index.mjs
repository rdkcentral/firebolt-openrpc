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
import { recursiveFileDirectoryList, clearDirectory, loadVersion, isFile, logSuccess } from '../shared/helpers.mjs'
import { setOptions, setVersion, setOutput, generateMacros, generateDocs, writeDocumentation } from './macros/index.mjs'
import { getSchemaContent, getAllSchemas, addSchema } from '../shared/json-schema.mjs'
import { getModuleContent, getAllModules, addModule } from '../shared/modules.mjs'
import path from 'path'
import fs from 'fs'
import { loadTemplateContent, setPathDelimiter, setSuffix } from '../shared/template.mjs'

// Workaround for using __dirname in ESM
import url from 'url'
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg,
  template: templateFolderArg,
  output: outputFolderArg,
  'as-path': asPath = false,
}) => {

  setPathDelimiter('/template/markdown/')
  setSuffix('.md')

  if (asPath) {
    setOptions({ asPath: true })
  }

  // Important file/directory locations
  const readMe = path.join('README.md')
  const apiIndex = path.join(__dirname, '..', '..', 'src', 'template', 'markdown', 'api.md')
  const versionJson = path.join('package.json')
  const sharedSchemasFolder = path.join(__dirname, '..', '..', 'src', 'schemas')
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const templateFolder = path.join(templateFolderArg)
  const sharedTemplateFolder = path.join(__dirname, '..', '..', templateFolderArg)
  const outputFolder = path.join(outputFolderArg)
  const getAllModulesStream = _ => h(getAllModules())
  const getAllSchemasStream = _ => h(getAllSchemas())
  const hasPublicMethods = json => json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
  const fsCopyFile = h.wrapCallback(fs.copyFile)
  const copyReadMe = _ => asPath ? fsCopyFile(apiIndex, path.join(outputFolder, 'index.md')) : fsCopyFile(readMe, path.join(outputFolder, 'index.md'))
  const createDocsDir = _ => h.wrapCallback(fs.mkdir)(path.join(outputFolder))
  const createSchemasDir = _ => h.wrapCallback(fs.mkdir)(path.join(outputFolder, 'schemas'))
  
  clearDirectory(outputFolder)
  .tap(_ => logSuccess(`Removed ${outputFolder}`))
  .flatMap(createDocsDir)
  .flatMap(createSchemasDir)
  .flatMap(copyReadMe)
  .tap(_ => setOutput(outputFolder))
  .tap(_ => logSuccess(`Created ${outputFolder}`))
  .tap(_ => logSuccess(`Created index.md`))
  // Load all of the templates
  .flatMap(_ => recursiveFileDirectoryList(sharedTemplateFolder).flatFilter(isFile))
  .through(loadTemplateContent)
  .collect()
  // Load all of the templates
  .flatMap(_ => recursiveFileDirectoryList(templateFolder).flatFilter(isFile))
  .through(loadTemplateContent)
  .collect()
  // Load all of the shared Firebolt JSON-Schemas
  .flatMap(_ => recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile))
  .through(getSchemaContent)
  .tap(addSchema)
  .collect()
  // Load all of the project Firebolt JSON-Schemas
  .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
  .through(getSchemaContent)
  .tap(addSchema)
  .collect()
  .tap(_ => logSuccess('Loaded JSON-Schemas'))
  // Load all of the Firebolt OpenRPC modules
  .flatMap(_ => recursiveFileDirectoryList(modulesFolder).flatFilter(isFile))
  .through(getModuleContent)
  .filter(hasPublicMethods)
  .sortBy(alphabeticalSorter)
  .tap(addModule)
  .collect()
  .tap(_ => logSuccess('Loaded OpenRPC modules'))
  // Load the version.json file
  .flatMap(_ => loadVersion(versionJson))
  .tap(setVersion)
  .tap(v => logSuccess(`Version: ${v.major}.${v.minor}.${v.patch}`))
  // Loop through modules
  .flatMap(_ => getAllModulesStream())
  .tap(generateMacros)
  .tap(generateDocs)
  .flatMap(writeDocumentation)
  .collect()
  .tap(x => logSuccess(`Created module docs`))
  // Copy template directory
  .flatMap(_ => getAllSchemasStream())
  .tap(generateMacros)
  .tap(generateDocs)
  .flatMap(writeDocumentation)
  .collect()
  .tap(x => logSuccess(`Created schema docs`))
  .done(() => console.log('\nThis has been a presentation of Firebolt OS'))
}

export default run