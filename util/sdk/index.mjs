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
import { bufferToString, fsReadFile, fsWriteFile, isDirectory, isFile, copyReferenceDirToTarget, copyReferenceFileToTarget, localModules, combineStreamObjects, schemaFetcher, loadFilesIntoObject, clearDirectory, fsMkDirP, logSuccess, logHeader, loadVersion, fileCollectionReducer, fsReadDir } from '../shared/helpers.mjs'
import { insertMacros, insertAggregateMacrosOnly } from './macros/index.mjs'
import path from 'path'

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
  'shared-schemas': sharedSchemasFolderArg,
  'static-modules': staticModules = false
}) => {
  // Important file/directory locations
  const packageJsonFile = path.join(srcFolderArg, '..', 'package.json')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const sdkTemplateFolder = path.join(templateFolderArg)
  const sharedSdkTemplateFolder = path.join(__dirname, '..', '..', 'src', 'template', 'js', 'sdk')
  const globalIndexLocation = path.join(sharedSdkTemplateFolder, '..', 'index.js')
  const globalDefaultsLocation = path.join(sharedSdkTemplateFolder, '..', 'defaults.js')
  const insertAggregateMacrosIntoFile = path => fsReadFile(path).map(bufferToString).map(insertAggregateMacrosOnly).flatMap(data => fsWriteFile(path, data))

  const allModules = localModules(modulesFolder, markdownFolder)
  const combinedSchemas = combineStreamObjects(schemaFetcher(sharedSchemasFolder), schemaFetcher(schemasFolder))
  const localTemplates = loadFilesIntoObject(sdkTemplateFolder, '.js', '/template/js/sdk/')
  const sharedTemplates = loadFilesIntoObject(sharedSdkTemplateFolder, '.js', '/template/js/sdk/')
  const globalDefaultTemplates = fsReadFile(globalIndexLocation).map(bufferToString)
    .flatMap(indexFileContents => fsReadFile(globalDefaultsLocation).map(bufferToString)
      .map(defaultsFileContents => {
        return {
          'index.js': indexFileContents,
          'defaults.js': defaultsFileContents
        }
      }))
  const sharedTopLevelTemplates = fsReadDir(sharedSdkTemplateFolder).flatFilter(isFile)
      .flatMap(file => fsReadFile(file)
        .map(bufferToString)
        .map(fileContents => [file, fileContents]))

  const pickTemplateForModule = (moduleTitle = 'Foo', file = 'index.js', templates = {}) => h(Object.entries(templates))
      .filter(([k, _v]) => {
        const dirPart = path.dirname(k)
        const filePart = path.basename(k)
        return dirPart === moduleTitle && filePart === file
      })

  const generateMacros = schemas => modules => (localTemplates = {}, sharedTemplates = {}, globalDefaults = {}) => version => {
    // Generate the macros object once and use in each stream item.
    const combinedTemplates = Object.assign(sharedTemplates, localTemplates)
    return h(Object.values(modules))
      .flatMap(module => {
        const moduleDir = path.join(outputFolderArg, module.info.title)

        // Pick the index and defaults templates for each module.
        const indexTemplate = pickTemplateForModule(module.info.title, 'index.js', localTemplates)
          .otherwise(h([[path.join(module.info.title, "index.js"), globalDefaults['index.js']]]))
        const defaultsTemplate = pickTemplateForModule(module.info.title, 'defaults.js', localTemplates)
          .otherwise(h([[path.join(module.info.title, "defaults.js"), globalDefaults['defaults.js']]]))
        // Any other files for this module? You know b/c it will look like `<moduleTitle>/file.js`  in localTemplates
        const otherModuleFiles = h(Object.entries(localTemplates))
          .filter(([k, _v]) => {
            const dirPart = path.dirname(k)
            return dirPart === module.info.title
          })
        const filesToWrite = h([indexTemplate, defaultsTemplate, otherModuleFiles]).merge().map(([k, v]) => [path.join(outputFolderArg, k), v])

        // insertMacros into templates as `macrofied`
        return fsMkDirP(moduleDir)
          .flatMap(_ => filesToWrite
            .tap(([fileName, _]) => {
              logSuccess(`Writing file: ${fileName}`)
            })
            .flatMap(([fileName, fileContents]) => fsWriteFile(fileName, fileContents)))
      })
  }

  logHeader(`Generating SDK into: ${outputFolderArg}`)
  return fsMkDirP(outputFolderArg)
    .tap(_ => logSuccess(`Created folder: ${outputFolderArg}`))
    .flatMap(clearDirectory(outputFolderArg)
      .tap(_ => logSuccess("Cleared folder if it already existed."))
      .flatMap(_ => combinedSchemas
        .map(generateMacros)
        .flatMap(fnWithSchemas => allModules
          .map(fnWithSchemas)
            .flatMap(fnWithModules => globalDefaultTemplates // Loads all 3 kinds of templates into context.
              .flatMap(globalDefaults => sharedTemplates
                .flatMap(shared => localTemplates
                  .map(local => fnWithModules(local, shared, globalDefaults))
                    .flatMap(fnWithTemplates => loadVersion(packageJsonFile)
                      .tap(v => logSuccess(`Generating ${v.readable} --${v.original}--`))
                      .flatMap(fnWithTemplates) // <-- This is calling generateMacros with the last of its arguments, version
                    )
                )
              )
            )
        )
      )
    )
}

export default run