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

import path from 'path'
import { readJson } from '../shared/filesystem.mjs'
import macrofy from '../macrofier/index.mjs'

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = async ({
  server: server,
  client: client,
  template: template,
  output: output,
  language: language,
  'static-module': staticModuleNames,
  argv: {
    remain: moduleWhitelist
  }
}) => {
  
  let mainFilename
  let declarationsFilename
  
  const config = {
    language: null,
    project: null
  }

  try {
    const projectDir = process.env.npm_config_local_prefix
    const workspaceDir = path.dirname(process.env.npm_package_json) 

    // Important file/directory locations
    const packageJsonFile = path.join(workspaceDir, 'package.json')
    const packageJson = await readJson(packageJsonFile)
    mainFilename = path.basename(packageJson.main)
    declarationsFilename = path.basename(packageJson.types)

    // Load project firebolt-openrpc.config.json, if it exists
    config.project = await readJson(path.join(projectDir, 'firebolt-openrpc.config.json'))
  }
  catch (error) {
    //console.dir(error)
     // fail silently
  }

  config.language = await readJson(path.join(language, 'language.config.json'))

  if (config.project && config.project.languages && config.project.languages[config.language.langcode]) {
    console.log(`Applying project overrides to language config:`)
    const overrides = config.project.languages[config.language.langcode]
    console.log(Object.entries(overrides).map( ([key, value]) => ` - ${key} -> ${JSON.stringify(value)}`).join('\n'))
    Object.assign(config.language, overrides)
  }
    
  return macrofy(server, client, template, output, {
    headline: 'SDK code',
    outputDirectory:    'sdk',
    sharedTemplates:    path.join(language, 'templates'),
    staticContent:      path.join(language, 'src', 'shared'),
    templatesPerModule: config.language.templatesPerModule,
    templatesPerSchema: config.language.templatesPerSchema,
    persistPermission: config.language.persistPermission,
    createPolymorphicMethods: config.language.createPolymorphicMethods,
    operators: config.language.operators,
    primitives: config.language.primitives,
    createModuleDirectories: config.language.createModuleDirectories,
    copySchemasIntoModules: config.language.copySchemasIntoModules,
    mergeOnTitle: config.language.mergeOnTitle,
    extractSubSchemas: config.language.extractSubSchemas,
    convertTuplesToArraysOrObjects: config.language.convertTuplesToArraysOrObjects,
    unwrapResultObjects: config.language.unwrapResultObjects,
    allocatedPrimitiveProxies: config.language.allocatedPrimitiveProxies,
    additionalSchemaTemplates: config.language.additionalSchemaTemplates,
    additionalMethodTemplates: config.language.additionalMethodTemplates,
    templateExtensionMap: config.language.templateExtensionMap,
    excludeDeclarations: config.language.excludeDeclarations,
    extractProviderSchema: config.language.extractProviderSchema,
    staticModuleNames: staticModuleNames,
    hideExcluded: true,
    moduleWhitelist: moduleWhitelist,
    aggregateFiles: config.language.aggregateFiles,
    rename: mainFilename ? { '/index.mjs': mainFilename, '/index.d.ts': declarationsFilename } : {},
    treeshakePattern: config.language.treeshakePattern ? new RegExp(config.language.treeshakePattern, "g") : undefined,
    treeshakeTypes: config.language.treeshakeTypes,
    treeshakeEntry: mainFilename ? '/' + mainFilename : '/index.mjs'
  })
}

export default run
