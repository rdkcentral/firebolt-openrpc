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
  input: input,
  template: template,
  output: output,
  language: language,
  'static-module': staticModuleNames
}) => {
  
  let mainFilename
  let declarationsFilename
  
  try {
    // Important file/directory locations
    const packageJsonFile = path.join(path.dirname(input), '..', 'package.json')
    const packageJson = await readJson(packageJsonFile)
    mainFilename = path.basename(packageJson.main)
    declarationsFilename = path.basename(packageJson.types)
  }
  catch (error) {
     // fail silently
  }
  
  const config = await readJson(path.join(language, 'language.config.json'))

  return macrofy(input, template, output, {
    headline: 'SDK code',
    outputDirectory:    'sdk',
    sharedTemplates:    path.join(language, 'templates'),
    staticContent:      path.join(language, 'src', 'shared'),
    templatesPerModule: config.templatesPerModule,
    createModuleDirectories: config.createModuleDirectories,
    copySchemasIntoModules: config.copySchemasIntoModules,
    staticModuleNames: staticModuleNames,
    hideExcluded: true,
    aggregateFile: config.aggregateFile,
    rename: mainFilename ? { '/index.mjs': mainFilename, '/index.d.ts': declarationsFilename } : {},
    treeshakePattern: config.treeshakePattern ? new RegExp(config.treeshakePattern, "g") : undefined,
    treeshakeTypes: config.treeshakeTypes,
    treeshakeEntry: mainFilename ? '/' + mainFilename : '/index.mjs'
  })
}

export default run