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
import macrofy from '../macrofier/index.mjs'
import { readJson } from '../shared/filesystem.mjs'
import { readConfigFile } from '../shared/configLoader.mjs';
/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = async ({
  platformApi: platformApi,
  appApi: appApi,
  template: template,
  output: output,
  examples: examples,
  language: language,
  config: config,
  'as-path': asPath
}) => {
  let libraryName = 'your-library' // TODO find a better default if package.json isn't available...

  // Important file/directory locations
  try {
    // Important file/directory locations
    const packageJsonFile = path.join(path.dirname(platformApi), '..', 'package.json')
    const packageJson = await readJson(packageJsonFile)
    libraryName = packageJson.name || libraryName
  }
  catch (error) {
     // fail silently
     throw error
  }
  // Load in config
  const conf = await readConfigFile(config, language);
  
  return macrofy(platformApi, appApi, template, output, {
    headline: "documentation",
    outputDirectory:    'content',
    sharedTemplates:    path.join(language, 'templates'),
    createModuleDirectories: asPath,
    copySchemasIntoModules: conf.copySchemasIntoModules,
    examples: examples,
    templatesPerModule: conf.templatesPerModule,
    templatesPerSchema: conf.templatesPerSchema,
    operators: conf.operators,
    libraryName: libraryName,
    hidePrivate: false,
    enableListenAndOnceDeclarations: conf.enableListenAndOnceDeclarations || false

  })
}

export default run