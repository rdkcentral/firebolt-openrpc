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

import path from "path"

const isSynchronous = m => !m.tags ? false : m.tags.map(t => t.name).find(s => s === 'synchronous')

// getMethodSignature(method, module, options = { destination: 'file.txt' })
// getMethodSignatureParams(method, module, options = { destination: 'file.txt' })
// getSchemaType(schema, module, options = { destination: 'file.txt' })
// getSchemaShape(schema, module, options = { name: 'Foo', destination: 'file.txt' })

function getMethodSignature(method, module, {  destination = '' } = {}) {    
    return routeToDestination('getMethodSignature', arguments)
}

function getMethodSignatureParams(method, module, { destination = '' } = {}) {
    return routeToDestination('getMethodSignatureParams', arguments)
}

function getSchemaShape(schema = {}, module = {}, { name = '', destination = '', level = 0, descriptions = true} = {}) {
    return routeToDestination('getSchemaShape', arguments)
}

function getSchemaType(schema, module, { destination = '', link = false, title = false, code = false, asPath = false, baseUrl = '' } = {}) {
    const value = routeToDestination('getSchemaType', arguments)
    return value
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

export default {
    getMethodSignature,
    getMethodSignatureParams,
    getSchemaShape,
    getSchemaType,
}