#!/usr/bin/env node

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
import { recursiveFileDirectoryList, clearDirectory, gatherStateForInsertMacros, getModuleName, loadVersion, fsReadFile, fsWriteFile, isDirectory, isFile, createFilesAbsentInDir, createDirAbsentInDir, loadFileContent, copyReferenceDirToTarget, copyReferenceFileToTarget, logSuccess } from '../shared/helpers.mjs'
import { setVersion, generateMacros, insertMacros, insertAggregateMacrosOnly } from './macros/index.mjs'
import { getModuleContent, getAllModules, addModule } from '../shared/modules.mjs'
import { localizeDependencies, getSchemaContent, addExternalMarkdown, addSchema } from '../shared/json-schema.mjs'
import path from 'path'

// Workaround for using __dirname in ESM
import url from 'url'
import { bufferToString } from '../shared/helpers.mjs'

// TODO: move somewhere...
import { addStaticModule } from './macros/index.mjs'

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg,
  template: templateFolderArg,
  output: outputFolderArg,
  'shared-schemas': sharedSchemasFolderArg,
  'static-modules': staticModules = false
}) => {
  // Important file/directory locations
  const versionJson = path.join('package.json')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const templateFolder = path.join(__dirname, '..', '..', 'src', 'template', 'js')
  const sdkTemplateFolder = path.join(templateFolderArg, 'sdk')
  const sharedSdkTemplateFolder = path.join(__dirname, '..', '..', 'src', 'template', 'js', 'sdk')
  const outputFolder = path.join(outputFolderArg)
  const createDirectoryFromShared = x => h([x]).flatFilter(isDirectory).flatMap(copyReferenceDirToTarget(sharedSdkTemplateFolder, outputFolder))
  const createFileFromShared = x => h([x]).flatFilter(isFile).flatMap(copyReferenceFileToTarget(sharedSdkTemplateFolder, outputFolder))
  const createDirectoryFromProject = x => h([x]).flatFilter(isDirectory).flatMap(copyReferenceDirToTarget(sdkTemplateFolder, outputFolder))
  const createFileFromProject = x => h([x]).flatFilter(isFile).flatMap(copyReferenceFileToTarget(sdkTemplateFolder, outputFolder))
  const getAllModulesStream = _ => h(getAllModules())
  const hasPublicMethods = json => json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0
  const insertAggregateMacrosIntoFile = path => fsReadFile(path).map(bufferToString).map(insertAggregateMacrosOnly).flatMap(data => fsWriteFile(path, data))
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0

  // Objects we'll use to perform side effects while processing the stream.
  const templates = {};
  const descriptions = {};

  if (staticModules) {
    staticModules.split(',').forEach(m => addStaticModule(m))
  }
  
  clearDirectory(outputFolder)
    // Load all of the templates
    .flatMap(_ => recursiveFileDirectoryList(templateFolder).flatFilter(isFile))
    .through(loadFileContent('.js'))
    // SIDE EFFECTS!!!
    .tap(payload => {
      const [filepath, data] = payload
      const key = filepath.split('/template/js/')[1]
      templates[key] = data
    })
    .collect()
    // load all shared schemas
    .flatMap(_ => recursiveFileDirectoryList(sharedSchemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    // Side effects part 1.
    .map(addExternalMarkdown(descriptions))
    .tap(addSchema)
    .collect()
    // load all schemas
    .flatMap(_ => recursiveFileDirectoryList(schemasFolder).flatFilter(isFile))
    .through(getSchemaContent)
    // Side effects part 2.
    .map(addExternalMarkdown(descriptions))
    .tap(addSchema)
    .collect()
    .tap(_ => logSuccess('Loaded JSON-Schemas'))
    // Load all modules
    .flatMap(_ => recursiveFileDirectoryList(modulesFolder).flatFilter(isFile))
    .through(getModuleContent)
    .filter(hasPublicMethods)
    .sortBy(alphabeticalSorter)
    .map(m => localizeDependencies(m, m, true))
    .tap(addModule)
    // Here's where the actual code generation takes place.
    .map(generateMacros(templates))
    .collect()
    .tap(_ => logSuccess("Loading all modules"))
    // Load the version.json file
    .flatMap(_ => loadVersion(versionJson))
    .tap(setVersion)
    .tap(v => logSuccess(`Loaded version:  ${v.major}.${v.minor}.${v.patch}`))
    // Copy global template directory
    .flatMap(_ => recursiveFileDirectoryList(sharedSdkTemplateFolder))
    .flatMap(dirOrFile => createDirectoryFromShared(dirOrFile).concat(createFileFromShared(dirOrFile)))
    .collect()
    // Copy project template directory
    .flatMap(_ => recursiveFileDirectoryList(sdkTemplateFolder))
    .flatMap(dirOrFile => createDirectoryFromProject(dirOrFile).concat(createFileFromProject(dirOrFile)))
    .collect()
    .flatMap(_ => recursiveFileDirectoryList(outputFolder)).flatFilter(isFile)
    .flatMap(insertAggregateMacrosIntoFile)
    .collect()
    .tap(_ => logSuccess(`Copied template directory`))
    .flatMap(_ => getAllModulesStream())
    .flatMap(getModuleName)
    .flatMap(moduleName => createDirAbsentInDir(path.join(outputFolder, moduleName))
      .concat(createFilesAbsentInDir(['index.js', 'defaults.js'], path.join(outputFolder, moduleName), path.join(sharedSdkTemplateFolder, '..')))
    )
    .collect()
    // TODO: reuse already loaded moduleContent
    .flatMap(_ => getAllModulesStream())
    // Here's where the actual code generation takes place.
    .map(generateMacros(templates))
    // Make sure all modules pass through 'generateMacros' so the aggregate macros are done
    .collect()
    // split the stream back up again
    .sequence()
    // Get the full file path, the contents of the file,
    // and the generated code all in the same context
    .flatMap(gatherStateForInsertMacros(outputFolder))
    // Replace macros with generated code
    .map(insertMacros)
    .flatMap(([file, fContents]) => fsWriteFile(file, fContents).map(_ => [file, fContents.length]))
    .collect()
    .tap(_ => logSuccess(`Generated JavaScript modules`))
    .done(() => console.log('\nThis has been a presentation of Firebolt OS'))
}

export default run