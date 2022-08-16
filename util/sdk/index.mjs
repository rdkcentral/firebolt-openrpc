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
import { fsWriteFile, fsCopy, localModules, combineStreamObjects, schemaFetcher, loadFilesIntoObject, clearDirectory, fsMkDirP, logSuccess, logHeader, loadJson, trimPath } from '../shared/helpers.mjs'
import { insertMacros, insertAggregateMacrosOnly, generateMacros, generateAggregateMacros } from './macros/index.mjs'
import path from 'path'

// Workaround for using __dirname in ESM
import url from 'url'
import { localizeDependencies } from '../shared/json-schema.mjs'
import compose from 'crocks/helpers/compose.js'
import safe from 'crocks/Maybe/safe.js'
import isString from 'crocks/core/isString.js'
import option from 'crocks/pointfree/option.js'
import map from 'crocks/pointfree/map.js'
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
  'static-modules': staticModulesArg
}) => {
  // Important file/directory locations
  const packageJsonFile = path.join(srcFolderArg, '..', 'package.json')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const sdkTemplateFolder = path.join(templateFolderArg)
  const sharedSdkTemplateFolder = path.join(__dirname, '..', '..', 'src', 'template', 'js', 'sdk')
  const staticSdkCodeFolder = path.join(__dirname, '..', '..', 'src', 'js', 'shared')
  
  const allModules = localModules(modulesFolder, markdownFolder)
  const combinedSchemas = combineStreamObjects(schemaFetcher(sharedSchemasFolder), schemaFetcher(schemasFolder)) // Used to 
  const localTemplates = loadFilesIntoObject(sdkTemplateFolder, ['.js', '.mjs'] , '/template/js/sdk/')
  const allSharedTemplates = loadFilesIntoObject(path.join(sharedSdkTemplateFolder, '..'), ['.js', '.mjs'], '/template/js/') // For breaking down later

  const getStaticModules = compose(
    option([]),
    map(map(x => x.trim())),
    map(x => x.split(',')),
    safe(isString)
  )

  // Mock up the static modules to look as much like regular modules as needed.
  const staticModules = getStaticModules(staticModulesArg).reduce((acc, mod) => {
    acc[mod] = {info: {title: mod}}
    return acc
  }, {})

  const pickTemplateForModule = (moduleTitle = 'Foo', file = 'index.js', templates = []) => h(templates)
      .filter(([k, _v]) => {
        const dirPart = path.dirname(k)
        const filePart = path.basename(k)
        return dirPart === moduleTitle && filePart === file // <-- <moduleTitle>/<file>
      })

  const macroOrchestrator = schemas => modules => (localTemplates = [], sharedTemplates = [], globalDefaults = [], codeTemplates = []) => packageJson => {
    
    const macrosAlmost = generateMacros(Object.fromEntries(codeTemplates)) // <-- method expects object
    
    const combinedTemplates = Object.entries(
      Object.assign(
        Object.fromEntries(sharedTemplates),
        Object.fromEntries(localTemplates)
      )
    ) // <-- local templates override any shared templates

    const macrofiedModules = h(Object.values(modules)
      .concat(Object.values(staticModules))) // <-- Static modules also get the macrofication spa treatment
      .map(module => localizeDependencies(module, module, schemas, { externalOnly: true, keepRefsAndLocalizeAsComponent: true }))
      .flatMap(module => {
        const macros = macrosAlmost(module) // <-- call generateMacros with final async context

        // Pick the index and defaults templates for each module.
        const indexTemplate = pickTemplateForModule(module.info.title, 'index.js', combinedTemplates)
          .otherwise(h([[path.join(module.info.title, "index.mjs"), globalDefaults.find(([k, _]) => k === 'index.js')[1]]])) // <-- [['index.js', 'template content'], ...]. Find kv pair, then take index 1 for the content
        const defaultsTemplate = pickTemplateForModule(module.info.title, 'defaults.js', combinedTemplates)
          .otherwise(h([[path.join(module.info.title, "defaults.mjs"), globalDefaults.find(([k, _]) => k === 'defaults.js')[1]]]))
        // Any other files for this module? You know b/c it will look like `<moduleTitle>/file.js`  in combinedTemplates
        const otherModuleFiles = h(combinedTemplates)
          .filter(([k, _v]) => {
            const dirPart = path.dirname(k)
            return dirPart === module.info.title
          })
        
        return h([indexTemplate, defaultsTemplate, otherModuleFiles])
          .merge()
          .map(([file, contents]) => {
            const macrofied = insertMacros(contents, macros, module, packageJson) // <-- macro replacement
            return [file, macrofied]
          })
      })
    
    const aggregateMacros = generateAggregateMacros(Object.fromEntries(codeTemplates), Object.assign(modules, staticModules), packageJson)
    
    return h(combinedTemplates)
      .concat(macrofiedModules) // <-- concat guarantees macrofied content wins over plain template content
      .map(([file, contents]) => {
        return [file, insertAggregateMacrosOnly(contents, aggregateMacros, packageJson)] // <-- aggregate macro replacement happens for all
      })
      .map(([k, v]) => [path.join(outputFolderArg, k), v]) // <-- concat output folder arg with template path
      .tap(([file, _]) => {
        logSuccess(`Creating file: ${trimPath(file)}`)
      })
      .flatMap(([file, contents]) => fsMkDirP(path.dirname(file))
        .flatMap(_ => fsWriteFile(file, contents)))
  }

  logHeader(`Generating SDK into: ${trimPath(outputFolderArg)}`)
  return fsMkDirP(outputFolderArg)
    .tap(_ => logSuccess(`Created folder: ${trimPath(outputFolderArg)}`))
    .flatMap(clearDirectory(outputFolderArg)
      .tap(_ => logSuccess("Cleared folder if it already existed."))
      .flatMap(_ => fsCopy(staticSdkCodeFolder, outputFolderArg))
      .tap(_ => logSuccess("Copied static code into it."))
      .flatMap(_ => combinedSchemas
        .map(macroOrchestrator)
        .flatMap(fnWithSchemas => allModules
          .map(fnWithSchemas)
            .flatMap(fnWithModules => allSharedTemplates // Loads all 4 kinds of templates into an object.
              .flatMap(shared => {
                const methodTemplates = Object.entries(shared).filter(([k, _]) => !path.dirname(k).startsWith('sdk'))
                const sharedSdkTemplates = Object.entries(shared).filter(([k, _]) => path.dirname(k).startsWith('sdk')).map(([k, v]) => [k.slice(4), v])
                const globalDefaults = Object.entries(shared).filter(([k, _]) => path.dirname(k) === '.')
                return localTemplates
                  .map(local => fnWithModules(Object.entries(local), sharedSdkTemplates, globalDefaults, methodTemplates))
                  .flatMap(fnWithTemplates => loadJson(packageJsonFile)
                    .tap(p => logHeader(`Generating ${p.description} --${p.version}--`))
                    .flatMap(fnWithTemplates) // <-- This is calling macroOrchestrator with the last of its arguments, the parsed package.json 
                )
              })
            )
        )
      )
    )
}

export default run