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
import { loadConfig } from '../shared/configLoader.mjs';

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = async ({
  platformApi: platformApi,
  appApi: appApi,
  template: template,
  output: output,
  language: language,
  config: config,
  'static-module': staticModuleNames,
  argv: {
    remain: moduleWhitelist
  }
}) => {
  
  let mainFilename
  let declarationsFilename
  
  try {
    // Important file/directory locations
    const packageJsonFile = path.join(path.dirname(platformApi), '..', 'package.json')
    const packageJson = await readJson(packageJsonFile)
    mainFilename = path.basename(packageJson.main)
    declarationsFilename = path.basename(packageJson.types)
  }
  catch (error) {
     // fail silently
  }
  
  // Load in config
  const conf = await loadConfig(config, language);

  return macrofy(platformApi, appApi, template, output, {
    headline: 'SDK code',
    outputDirectory:    'sdk',
    sharedTemplates:    path.join(language, 'templates'),
    staticContent:      path.join(language, 'src', 'shared'),
    templatesPerModule: conf.templatesPerModule,
    templatesPerSchema: conf.templatesPerSchema,
    persistPermission: conf.persistPermission,
    createPolymorphicMethods: conf.createPolymorphicMethods || false,
    enableUnionTypes: conf.enableUnionTypes || false,
    operators: conf.operators,
    primitives: conf.primitives,
    createModuleDirectories: conf.createModuleDirectories,
    copySchemasIntoModules: conf.copySchemasIntoModules,
    extractSubSchemas: conf.extractSubSchemas,
    convertTuplesToArraysOrObjects: conf.convertTuplesToArraysOrObjects,
    unwrapResultObjects: conf.unwrapResultObjects,
    allocatedPrimitiveProxies: conf.allocatedPrimitiveProxies,
    additionalSchemaTemplates: conf.additionalSchemaTemplates,
    additionalMethodTemplates: conf.additionalMethodTemplates,
    templateExtensionMap: conf.templateExtensionMap,
    excludeDeclarations: conf.excludeDeclarations,
    extractProviderSchema: conf.extractProviderSchema,
    staticModuleNames: staticModuleNames,
    hideExcluded: true,
    moduleWhitelist: moduleWhitelist,
    aggregateFiles: conf.aggregateFiles,
    rename: mainFilename ? { '/index.mjs': mainFilename, '/index.d.ts': declarationsFilename } : {},
    treeshakePattern: conf.treeshakePattern ? new RegExp(conf.treeshakePattern, "g") : undefined,
    treeshakeTypes: conf.treeshakeTypes,
    treeshakeEntry: mainFilename ? '/' + mainFilename : '/index.mjs',
    enableListenAndOnceDeclarations: conf.enableListenAndOnceDeclarations || false
  })
}

export default run
