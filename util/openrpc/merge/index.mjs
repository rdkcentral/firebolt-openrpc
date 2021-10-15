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
let openrpc = {}
let output

const setTemplate = json => openrpc = json
const setOutput = file => output = file
const mergeSchemas = module => openrpc.components && openrpc.components.schemas && module.components && module.components.schemas && (Object.keys(module.components.schemas).forEach(key => openrpc.components.schemas[key.split('/').pop()] = module.components.schemas[key]))//  (Object.assign(openrpc.components.schemas, module.components.schemas))
const mergeMethods = module => openrpc.methods.push(...module.methods)
const setVersion = v => openrpc.info.version = v.major + '.' + v.minor + '.' + v.patch
const writeOpenRPC = _ => fsWriteFile(output, JSON.stringify(openrpc, null, '\t'))

const updateSchemaUris = schemas => {
    // drop the URI & path from each schema name
    Object.keys(schemas).forEach(key => {
        const schema = getExternalPath(key)
        if (schema) {
            const newKey = key.replace('/definitions/', '/components/schemas/').replace(key.split('#')[0], '')
            replaceRef(key, newKey, openrpc)
            schemas[key.split('/').pop()] = schemas[key]
            delete schemas[key]
        }
    })

    return schemas
}

export {
    setTemplate,
    setVersion,
    mergeSchemas,
    mergeMethods,
    updateSchemaUris,
    setOutput,
    writeOpenRPC
}