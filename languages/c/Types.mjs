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

import jsonTypes from './src/types/JSONTypes.mjs'
import commonTypes from './src/types/CommonCppTypes.mjs'
import headerCommonTypes from './src/types/CommonHeaderTypes.mjs'
import headerTypes from './src/types/HeaderTypes.mjs'
import cppTypes from './src/types/CppTypes.mjs'
import typeScriptTypes from '../../src/shared/typescript.mjs'
import { getNativeType } from './src/types/NativeHelpers.mjs'

import path from "path"

const isSynchronous = m => !m.tags ? false : m.tags.map(t => t.name).find(s => s === 'synchronous')

// getMethodSignature(method, module, options = { destination: 'file.txt' })
// getMethodSignatureParams(method, module, options = { destination: 'file.txt' })
// getSchemaType(schema, module, options = { destination: 'file.txt' })
// getSchemaShape(schema, module, options = { name: 'Foo', destination: 'file.txt' })

function getMethodSignature(method, module, {  destination = '' } = {}) {
    const returnType = getNativeType(method.result.schema)
    const useHandle = !returnType
    const extraParam = useHandle ? '${info.title}_${method.result.type}Handle* ${method.result.name}' : ''
    

    return (returnType || 'uint32_t') + ' ${info.title}_Get${method.Name}(' + extraParam + ')'
}

function getMethodSignatureParams(method, module, { destination = '' } = {}) {
    return routeToDestination('getMethodSignatureParams', arguments)
}

function getSchemaShape(schema = {}, module = {}, { name = '', destination = '', level = 0, descriptions = true} = {}) {
    return routeToDestination('getSchemaShape', arguments)
}

function getSchemaType(schema, module, { destination = '', link = false, title = false, code = false, asPath = false, baseUrl = '' } = {}) {
    let type = getNativeType(schema)

    if (!type) {
        type = typeScriptTypes.getSchemaType(...arguments)

        const array = type.endsWith('[]')

        if (array) {
            type = type.substring(0, type.length-2)
            type = `${type}ObjectArrayHandle`
        }

        type = `${module.info.title}_${type}`
    }
    return type
}

function getJsonType(schema, module, { destination = '', link = false, title = false, code = false, asPath = false, baseUrl = '' } = {}) {
    let type = getSchemaType(...arguments)

    // FireboltSDK::JSON::String&, etc.
    // FireboltSDK::<Module>::<Schema>& 
    // WPEFramework::Core::JSON::Boolean

    const array = type.endsWith('[]')

    if (array) {
        type = type.substring(0, type.length-2)
    }

    let jsonType

    if (type === 'string') {
        jsonType = 'FireboltSDK::JSON::String'
    }
    else if (type === 'boolean') {
        jsonType = 'WPEFramework::Core::JSON::Boolean'
    }
    else {
        jsonType = `FireboltSDK::${module.info.title}::${getSchemaType(...arguments)}`
    }

    if (array) {
        jsonType = `WPEFramework::Core::JSON::ArrayType<${jsonType}>`
    }

    return `${jsonType}&`
}

function routeToDestination(method, args) {
    const destination = args[args.length-1].destination || ''

    if ( path.basename(destination) === 'JsonData_Module.h') {
        return jsonTypes[method](...args)
    }
    else if (path.basename(destination) === 'Module.cpp') {
        return cppTypes[method](...args)
    }
    else if (path.basename(destination) === 'Module_Common.cpp') {
        return commonTypes[method](...args)
    }
    else if (path.basename(destination) === 'Module.h' && path.dirname(destination).endsWith(path.sep + 'Common')) {
        return headerCommonTypes[method](...args)
    }
    else if (path.basename(destination) === 'Module.h') {
        return headerTypes[method](...args)
    }

    return ''
}

function getPrimativeType(schema) {
    if (schema.type === "boolean") {
        return "bool"
    }
    else if (schema.type === "integer") {
        return "uint32_t"
    }
    else if (schema.type === "number") { 
        return 
    }
}

export default {
    getMethodSignature,
    getMethodSignatureParams,
    getSchemaShape,
    getSchemaType,
    getJsonType
}