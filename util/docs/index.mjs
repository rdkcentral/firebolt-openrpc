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
import { fsMkDirP, fsCopyFile, loadFilesIntoObject, combineStreamObjects, schemaFetcher, localModules, loadVersion, trimPath } from '../shared/helpers.mjs'
import { clearDirectory, logSuccess, fsWriteFile } from '../shared/helpers.mjs'
import { getDirectory, getFilename } from '../shared/helpers.mjs'
import { insertMacros } from './macros/index.mjs'
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
  'shared-schemas': sharedSchemasFolderArg,
  output: outputFolderArg,
  'as-path': asPath = false,
}) => {
  // Important file/directory locations
  const readMe = path.join('README.md')
  const apiIndex = path.join(__dirname, '..', '..', 'src', 'template', 'markdown', 'api.md')
  const packageJsonFile = path.join(srcFolderArg, '..', 'package.json')
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')
  const templateFolder = path.join(templateFolderArg)
  const sharedTemplateFolder = path.join(__dirname, '..', '..', 'src', 'template', 'markdown')
  const outputFolder = path.join(outputFolderArg)
  const copyReadMe = _ => asPath ? fsCopyFile(apiIndex, path.join(outputFolder, 'index.md')) : fsCopyFile(readMe, path.join(outputFolder, 'index.md'))

  // All the streams we care about.
  const combinedTemplates = combineStreamObjects(loadFilesIntoObject(sharedTemplateFolder, '.md', '/template/markdown/'), loadFilesIntoObject(templateFolder, '.md', '/template/markdown/'))
  const combinedSchemas = combineStreamObjects(schemaFetcher(sharedSchemasFolder), schemaFetcher(schemasFolder))
  
  const generateDocs = templates => modules => schemas => version => h(Object.entries(modules))
    .concat(Object.entries(schemas))
    .flatMap(([_, module]) => {
      const documentOptions = {
        asPath: asPath,
        baseUrl: ''
      }

      // TODO: what assumptions are made here?
      if (module.info !== undefined) {
        documentOptions.baseUrl = documentOptions.asPath ? '../' : './'
      } else {
        documentOptions.baseUrl = documentOptions.asPath ? '../../' : './'
      }

      const templateKey = module.info !== undefined ? 'index.md': 'schema.md'
      const template = templates[templateKey]
      const macrofied = insertMacros(template, module, templates, schemas, documentOptions, version)
      const fileToWrite = path.join(
        outputFolder,
        getDirectory(module, documentOptions.asPath),
        getFilename(module, documentOptions.asPath) + '.md'
      )
      return fsWriteFile(fileToWrite, macrofied)
        .map(_ => fileToWrite)
    })

  return clearDirectory(outputFolder)
    .tap(_ => logSuccess(`Removed ${trimPath(outputFolder)}`))
    .flatMap(fsMkDirP(path.join(outputFolder, 'schemas')))
    .flatMap(copyReadMe)
    .tap(_ => logSuccess(`Created ${trimPath(outputFolder)}`))
    .tap(_ => logSuccess(`Created index.md`))
    // This is basically a liftA4. This "lifts" a piece of synchronous data, the `insertMacros` function, indirectly through the `generateDocs` function,
    // into the context of 4 (A4 "arity 4") other pieces of asynchronous data: combinedTemplates, localModules, combinedSchemas, and loadVersion.
    .flatMap(_ => combinedTemplates
      .map(generateDocs)
      .flatMap(fnWithTemplates => localModules(modulesFolder, markdownFolder)
        .map(fnWithTemplates)
        .flatMap(fnWithModules => combinedSchemas
          .map(fnWithModules)
          .flatMap(fnWithSchemas => loadVersion(packageJsonFile).tap(v => logSuccess(`Generating docs for version ${v.readable}`)).flatMap(fnWithSchemas)))
      )
    )
    .errors((err, push) => {
      console.log(err)
      push(null)
    })
    .tap(file => {
      const filename = trimPath(file, process.cwd())
      logSuccess(`Created module doc: ${filename}`)
    })
}

export default run