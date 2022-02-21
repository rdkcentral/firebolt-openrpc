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
import { fsMkDirP, fsCopyFile, recursiveFileDirectoryList, clearDirectory, loadVersion, isFile, logSuccess, loadFileContent, fsWriteFile } from '../shared/helpers.mjs'
import { setVersion, insertMacros } from './macros/index.mjs'
import { getSchemaContent, getAllSchemas, addSchema, addExternalMarkdown } from '../shared/json-schema.mjs'
import { getAllModules, addModule, generatePropertyEvents, generatePropertySetters, generatePolymorphicPullEvents } from '../shared/modules.mjs'
import path from 'path'
import fs from 'fs'

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
  'shared-schemas': sharedSchemasFolderArg,
  output: outputFolderArg,
  'as-path': asPath = false,
}) => {

  // Objects we'll use to perform side effects while processing the stream.
  const templates = {};
  const descriptions = {};

  // Important file/directory locations
  const readMe = path.join('README.md')
  const apiIndex = path.join(__dirname, '..', '..', 'src', 'template', 'markdown', 'api.md')
  const versionJson = path.join('package.json')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')
  const templateFolder = path.join(templateFolderArg)
  const sharedTemplateFolder = path.join(__dirname, '..', '..', 'src', 'template', 'markdown')
  const outputFolder = path.join(outputFolderArg)
  const getAllSchemasStream = _ => h(getAllSchemas())
  const hasPublicMethods = json => json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
  const copyReadMe = _ => asPath ? fsCopyFile(apiIndex, path.join(outputFolder, 'index.md')) : fsCopyFile(readMe, path.join(outputFolder, 'index.md'))
  
  clearDirectory(outputFolder)
    .tap(_ => logSuccess(`Removed ${outputFolder}`))
    .flatMap(fsMkDirP(path.join(outputFolder, 'schemas')))
    .flatMap(copyReadMe)
    .tap(_ => logSuccess(`Created ${outputFolder}`))
    .tap(_ => logSuccess(`Created index.md`))
    // Load all of the shared templates
    .flatMap(_ => recursiveFileDirectoryList(sharedTemplateFolder).flatFilter(isFile))
    .through(loadFileContent('.md'))
    // SIDE EFFECTS mutate templates object
    .tap(payload => {
      const [filepath, data] = payload
      templates[filepath.split('/template/markdown/')[1]] = data
    })
    .collect()
    .tap(_ => logSuccess(`Loaded shared templates.`))
    // Load all of the templates
    .flatMap(_ => recursiveFileDirectoryList(templateFolder).flatFilter(isFile))
    .through(loadFileContent('.md'))
    // SIDE EFFECTS further mutate templates object
    .tap(payload => {
      const [filepath, data] = payload
      templates[filepath.split('/template/markdown/')[1]] = data
    })
    .collect()
    .tap(_ => logSuccess(`Loaded local templates.`))
    // Load all of the external markdown resources
    .flatMap(_ => recursiveFileDirectoryList(markdownFolder).flatFilter(isFile))
    .through(loadFileContent('.md'))
    // SIDE EFFECTS mutate descriptions
    .tap(payload => {
      const [filepath, data] = payload
      descriptions[filepath.split('/template/markdown/')[1]] = data
    })
    .collect()
    .tap(_ => logSuccess(`Loaded external markdown resources.`))
    // Load all of the shared Firebolt JSON-Schemas
    .flatMap(_ => recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    // Side effects previously performed somewhere after getSchemaContent
    .map(addExternalMarkdown(descriptions))
    .tap(addSchema)
    .collect()
    // Load all of the project Firebolt JSON-Schemas
    .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    // Side effects previously performed somewhere after getSchemaContent
    .map(addExternalMarkdown(descriptions))
    .tap(addSchema)
    .collect()
    .tap(_ => logSuccess('Loaded JSON-Schemas'))
    // Load all of the Firebolt OpenRPC modules
    .flatMap(_ => recursiveFileDirectoryList(modulesFolder).flatFilter(isFile))
    .through(getSchemaContent)
    // Side effects previously performed somewhere after getSchemaContent
    .map(addExternalMarkdown(descriptions))
    .map(generatePropertyEvents)
    .map(generatePropertySetters)
    .map(generatePolymorphicPullEvents)
    .filter(hasPublicMethods)
    .sortBy(alphabeticalSorter)
    .tap(addModule)
    .collect()
    .tap(_ => logSuccess('Loaded OpenRPC modules'))
    // Load the version.json file
    .flatMap(_ => loadVersion(versionJson))
    .tap(setVersion)
    .tap(v => logSuccess(`Version: ${v.major}.${v.minor}.${v.patch}`))
    .collect()
    // Loop through modules
    .flatMap(_ => h(getAllModules()))
    .flatMap(module => {
      const documentOptions = {
        asPath: true,
        baseUrl: ''
      }
      if (module.info !== undefined) {
        documentOptions.baseUrl = '../'
      } else {
        documentOptions.baseUrl = '../../'
      }

      const templateKey = module.info !== undefined ? 'index.md': 'schema.md'
      const template = templates[templateKey]
      const macrofied = insertMacros(template, module, templates, documentOptions)
      return fsWriteFile(path.join(
        outputFolder,
        `${module.info.title}.md`,
      ), macrofied)
    })
    .collect()
    .tap(x => logSuccess(`Created module docs`))
  // // Copy template directory
  // .flatMap(_ => getAllSchemasStream())
  // .tap(generateMacros)
  // .tap(x => generateDocs(x, templates))
  // .flatMap(writeDocumentation)
  // .collect()
  // .tap(x => logSuccess(`Created schema docs`))
  .done(() => console.log('\nThis has been a presentation of Firebolt OS'))
}

export default run