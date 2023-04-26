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

// import deepmerge from 'deepmerge'
// import { getPath, getSchema, localizeDependencies } from '../../src/shared/json-schema.mjs'
// import { getLinkFromRef } from '../../src/shared/markdown.mjs'
// import {  getProviderInterfaceMethods, getPayloadFromEvent } from '../../src/shared/modules.mjs'


// getMethodSignature(method, module, options = { destination: 'file.txt' })
// getMethodSignatureParams(method, module, options = { destination: 'file.txt' })
// getSchemaType(schema, module, options = { destination: 'file.txt' })
// getSchemaShape(schema, module, options = { name: 'Foo', destination: 'file.txt' })
// getProviderInterface(capability, module, options = { destination: 'file.txt' } )

function getMethodSignature(method, module, { destination = '' } = {}) {
    return `// CPP Signatures for ${module}_${method}`
}

function getMethodSignatureParams(method, module, { destination = '' } = {}) {
    return `// CPP Signature Params for ${module}_${method}`    
}

const safeName = prop => prop.match(/[.+]/) ? '"' + prop + '"' : prop

function getSchemaShape(schema = {}, module = {}, { name = '', destination = '', level = 0, descriptions = true} = {}) {
  return `// CPP Schema Shape`
}

function getSchemaType(schema, module, { schemas = {}, destination = '', link = false, title = false, code = false, asPath = false, baseUrl = '' } = {}) {
  return `// CPP Schema Type`
}


export default {
    getMethodSignature,
    getMethodSignatureParams,
    getSchemaShape,
    getSchemaType,
}