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
import { fileCollectionReducer, fsMkDirP, fsCopyFile, recursiveFileDirectoryList, clearDirectory, isFile, logSuccess, loadFileContent, fsWriteFile, fsReadFile, bufferToString, getDirectory, getFilename } from '../shared/helpers.mjs'
import { insertMacros } from './macros/index.mjs'
import { getExternalMarkdownPaths } from '../shared/json-schema.mjs'
import { generatePropertyEvents, generatePropertySetters, generatePolymorphicPullEvents } from '../shared/modules.mjs'
import path from 'path'

// Workaround for using __dirname in ESM
import url from 'url'
import getPathOr from 'crocks/helpers/getPathOr.js'
import { homedir } from 'os'
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
  const hasPublicMethods = json => json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0
  const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
  const copyReadMe = _ => asPath ? fsCopyFile(apiIndex, path.join(outputFolder, 'index.md')) : fsCopyFile(readMe, path.join(outputFolder, 'index.md'))
  
  // For convenience.
  const markdownFileReducer = fileCollectionReducer('/template/markdown/')
  const schemaMapper = ([_filepath, data]) => {
    const parsed = JSON.parse(data)
    if (parsed && parsed.$id) {
      return  [parsed.$id, parsed]
    }
  }

  // All the streams we care about.
  const loadVersion = fsReadFile(packageJsonFile)
    .map(bufferToString)
    .map(JSON.parse)
    // Removing information from sem-ver. Not sure of the reason.
    .map(x => {
      const preDash = x.version.split('-').map(y => y.split('.'))[0]
      return {
        major: preDash[0],
        minor: preDash[1],
        patch: preDash[2],
        readable: preDash.join('.'),
      }
    })

  const sharedTemplates = recursiveFileDirectoryList(sharedTemplateFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.md'))
    .reduce({}, markdownFileReducer)

  const localTemplates = recursiveFileDirectoryList(templateFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.md'))
    .reduce({}, markdownFileReducer)
  
  const externalMarkdownDescriptions = recursiveFileDirectoryList(markdownFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.md'))
    .reduce({}, fileCollectionReducer('/src/'))
  
  // TODO: Add error handling back to json docs.
  const sharedSchemas = recursiveFileDirectoryList(sharedSchemasFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.json'))
    .map(schemaMapper)
    .reduce({}, fileCollectionReducer())
  
  const localSchemas = recursiveFileDirectoryList(schemasFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.json'))
    .map(schemaMapper)
    .reduce({}, fileCollectionReducer())
  
  const localModules = recursiveFileDirectoryList(modulesFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.json'))
    .flatMap(([filepath, data]) => h.of(data)
      .map(JSON.parse)
      .map(generatePropertyEvents)
      .map(generatePropertySetters)
      .map(generatePolymorphicPullEvents)
      .filter(hasPublicMethods)
      .sortBy(alphabeticalSorter)
      .map(transformedData => [filepath, transformedData])
    )
    .flatMap(payload => {
      const [filepath, data] = payload
      const paths = getExternalMarkdownPaths(data)
      // Note that this only evaluates descriptions if there are any to replace in the module.
      if (paths.length > 0) {
        return externalMarkdownDescriptions
          .map(descriptions => addExternalMarkdown(paths, data, descriptions))
          .map(withExternalMarkdown => [filepath, withExternalMarkdown])
      } else {
        // Nothing to replace
        return h.of(payload)
      }
    })
    .reduce({}, fileCollectionReducer('/modules/'))

  const addExternalMarkdown = (paths = [], data = {}, descriptions = {}) => {
    paths.map(path => {
      const urn = getPathOr(null, path, data)
      const url = urn.indexOf("file:../") == 0 ? urn.substr("file:../".length) : urn.substr("file:".length)
      const markdownContent = descriptions[url]
      path.pop() // last element is expected to be `$ref`
      const field = path.pop() // relies on this position being the field name
      const objectNode = getPathOr(null, path, data)
      objectNode[field] = markdownContent // This mutates `data` by reference because JavaScript!
    })
    return data
  }

  const combineStreamObjects = (...xs) => h([...xs]).flatten().collect().map(xs => Object.assign({}, ...xs))
  const combinedTemplates = combineStreamObjects(sharedTemplates, localTemplates)
  const combinedSchemas = combineStreamObjects(sharedSchemas, localSchemas)
  
  const generateDocs = templates => modules => schemas => version => h(Object.entries(modules))
    .concat(Object.entries(schemas))
    .flatMap(([_, module]) => {
      const documentOptions = {
        asPath: false,
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

  clearDirectory(outputFolder)
    .tap(_ => logSuccess(`Removed ${outputFolder}`))
    .flatMap(fsMkDirP(path.join(outputFolder, 'schemas')))
    .flatMap(copyReadMe)
    .tap(_ => logSuccess(`Created ${outputFolder}`))
    .tap(_ => logSuccess(`Created index.md`))
    // This is basically a liftA4. This "lifts" a piece of synchronous data, the `insertMacros` function, indirectly through the `generateDocs` function,
    // into the context of 4 (A4 "arity 4") other pieces of asynchronous data: combinedTemplates, localModules, combinedSchemas, and loadVersion.
    .flatMap(_ => combinedTemplates
      .map(generateDocs)
      .flatMap(fnWithTemplates => localModules
        .map(fnWithTemplates)
        .flatMap(fnWithModules => combinedSchemas
          .map(fnWithModules)
          .flatMap(fnWithSchemas => loadVersion.tap(v => logSuccess(`Generating docs for version ${v.readable}`)).flatMap(fnWithSchemas)))
      )
    )
    .errors((err, push) => {
      console.log(err)
      push(null)
      // err.message = filepath + ": " + err.message
      // console.error(`\n\x1b[41m ERROR:\x1b[0m ${err.message}\n`)
      // push(nil, err) // TODO: Verify do we want to push the err value downstream?
    })
    .tap(file => logSuccess(`Created module doc: ${file}`))
    .done(() => console.log('\nThis has been a presentation of Firebolt'))
}

export default run