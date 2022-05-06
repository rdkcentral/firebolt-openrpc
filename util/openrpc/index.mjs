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

import { loadVersion, logHeader, fsReadFile, combineStreamObjects, schemaFetcher, localModules, bufferToString, fsWriteFile, logSuccess, fsMkDirP, trimPath } from '../shared/helpers.mjs'
import path from 'path'
import url from 'url'
import { getMethods, getSchemas } from '../shared/modules.mjs'
import { getExternalSchemas } from '../shared/json-schema.mjs'

// destructure well-known cli args and alias to variables expected by script
const run = ({
  source: srcFolderArg,
  template: templateArg,
  'shared-schemas': sharedSchemasFolderArg,
  output: outputArg
}) => {
  // Important file/directory locations
  const sharedSchemasFolder = sharedSchemasFolderArg
  const schemasFolder = path.join(srcFolderArg, 'schemas')
  const modulesFolder = path.join(srcFolderArg, 'modules')
  const markdownFolder = path.join(srcFolderArg, 'descriptions')

  logHeader(`MERGING into: ${trimPath(outputArg)}`)

  const templateFile = fsReadFile(templateArg).map(bufferToString).map(JSON.parse)
  const versionObj = loadVersion(path.join(srcFolderArg, '..', 'package.json'))
  const combinedSchemas = combineStreamObjects(schemaFetcher(sharedSchemasFolder), schemaFetcher(schemasFolder))
  const openRpcModules = localModules(modulesFolder, markdownFolder, false, false) // Applies transforms, allows modules with only private methods

  return fsMkDirP(path.dirname(outputArg))
    .flatMap(_ => versionObj
      .flatMap(version => templateFile
        .flatMap(baseTemplate => combinedSchemas.flatMap(schemas => openRpcModules
          .map(Object.values)
          .flatten()
          // Renaming module methods
          .map(module => {
            const renamed = getMethods(module).map(method => {
              const { name, ...rest } = method
              return {
                name: module.info.title.toLowerCase() + '.' + method.name,
                ...rest
              }
            })
            module.methods = renamed
            return module
          })
          // Sticking the methods and schemas in the template
          .map(module => {
              baseTemplate.methods.push(...module.methods) // methods added here

              // Schemas from modules.
              const moduleSchemas = getSchemas(module)
                .reduce((acc, [key, schema]) => {
                  acc[key.split('/').pop()] = schema
                  return acc
                }, {})
              
              // External schemas with additional fancying up.
              const externalSchemas = Object.entries(getExternalSchemas(module, schemas))
                .map(([k, v]) => {
                  const pieces = k.split('/')
                  const newKey = pieces[pieces.length - 1]
                  return new Map([
                    [newKey, v]
                  ])
                })
                .reduce((acc, it) => {
                  acc = Object.assign(acc, Object.fromEntries(it))
                  return acc
                }, {})

              // Schemas getting added to template
              baseTemplate.components.schemas = Object.assign(baseTemplate.components.schemas, moduleSchemas, externalSchemas)
              baseTemplate.info.version = version.original // version from package.json
              return baseTemplate
          })
        )
      ))
    )
    .collect() // Drain all the asynchrony above.
    // clean up $ref URIs still pointing to external stuff.
    .map(thunk => {
      const [openRpc, ..._rest] = thunk // Because thunk is an array of 1
      const str = JSON.stringify(openRpc, null, '\t')
      const patt = /https\:\/\/meta\.comcast\.com\/firebolt\/([a-zA-Z0-9]+)\#\/definitions/g
      return str.replace(patt, '#/components/schemas')
    })
    .flatMap(fileContents => fsWriteFile(outputArg, fileContents))
    .tap(_ => logSuccess(`Wrote file ${outputArg}`))
}

export default run