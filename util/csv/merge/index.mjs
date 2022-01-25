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

import { fsWriteFile } from '../../shared/helpers.mjs'
import { getExternalPath, replaceRef } from '../../shared/json-schema.mjs'
let csv = 'Module,Method,Capabilties,Summary\n'
let output

const setOutput = file => output = file
const mergeSchemas = module => module//(Object.keys(module.components.schemas).forEach(key => openrpc.components.schemas[key.split('/').pop()] = module.components.schemas[key]))
const mergeMethods = module => module.methods.forEach(method => csv += `${module.info.title},${method.name},xrn:firebolt:capability:core:${module.info.title}:${method.name},"${method.summary}"\n`)
const setVersion = v => v
const writeCSV = _ => fsWriteFile(output, csv)

export {
    setVersion,
    mergeMethods,
    setOutput,
    writeCSV
}