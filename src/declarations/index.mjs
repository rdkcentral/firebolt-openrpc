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
import url from 'url'
import { readJson } from '../shared/filesystem.mjs'
import { logHeader, logSuccess } from '../shared/io.mjs'
import macrofy from '../shared/macrofier.mjs'
import { insertMacros, insertAggregateMacros, generateMacros, generateAggregateMacros } from './macros/index.mjs'

// Workaround for using __dirname in ESM
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
// destructure well-known cli args and alias to variables expected by script
const run = async ({
  input: input,
  template: template,
  output: output,
  'static-module': staticModuleNames
}) => {

  const engine = {
    generateMacros,
    generateAggregateMacros,
    insertMacros,
    insertAggregateMacros
  }
  
  return macrofy(input, template, path.dirname(output), engine, {
    headline: 'declarations',
    outputDirectory:    'declarations',
    clearTargetDirectory: false,
    sharedTemplates:    path.join(__dirname, '..', '..', 'languages', 'javascript', 'templates'),
    templatesPerModule: [],
    rename: { '/declarations.d.ts': path.basename(output) }
  })
}

export default run