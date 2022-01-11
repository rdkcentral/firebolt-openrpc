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

import { replaceRef } from './json-schema.mjs'

export function convertToOpenRPC(json) {
    const openRpc = {
        "openrpc": "1.2.4",
        "info": {
            "title": json.info.title.replace(/ API$/g, ''),
            "description": json.info.description,
            "version": "UNKNOWN"
        },
        "methods": []
    }

    if (json.methods) {
        Object.keys(json.methods).forEach(key => {
            
            const openRpcMethod = {
                "name": key,
                "summary": json.methods[key].summary
            }

            if (json.methods[key].result) {
                openRpcMethod.result = {
                    "name": "result",
                    "schema": JSON.parse(JSON.stringify(json.methods[key].result))
                }
            }
            else {
                openRpcMethod.result = {
                    "name": "result",
                    "schema": {
                        "const": "void"
                    }
                }
            }

            if (json.methods[key].params) {
                openRpcMethod.params = [
                    {
                        "name": "params",
                        "summary": "parameters for this call",
                        "required": true, // TODO, does thunder support no params?
                        "schema": JSON.parse(JSON.stringify(json.methods[key].params))
                    }
                ]
            }
            else {
                openRpcMethod.params = []
            }

            openRpc.methods.push(openRpcMethod)
        })
    }

    if (json.events) {
        Object.keys(json.events).forEach(key => {
            
            const eventRpcName = key.match(/^on[A-Z]/) ? key : 'on' + key[0].toUpperCase() + key.substr(1)

            if (eventRpcName !== key) {
//                console.log(`WARNING: Renaming ${json.info.title} event '${key}' to '${eventRpcName}'.`)
            }

            const openRpcMethod = {
                "name": eventRpcName,
                "summary": json.events[key].summary,
                "tags": [
                    { "name": "event" }
                ]
            }

            openRpcMethod.params = [
                {
                    "name": "listen",
                    "required": true,
                    "summary": "whether to listen, or stop listening",
                    "schema": {
                      "type": "boolean"
                    }
                }
            ]

            if (json.events[key].params) {
                openRpcMethod.result = {
                    "name": "value",
                    "schema": {
                      "oneOf": [
                        JSON.parse(JSON.stringify(json.events[key].params)),
                        {
                          "$ref": "https://meta.comcast.com/firebolt/types#/definitions/ListenResponse"
                        }
                      ]
                    }
                }
            }
            else {
                openRpcMethod.result = {
                    "name": "result",
                    "schema": {
                        "oneOf": [
                            {
                                "const": "void"
                            },
                            {
                                "$ref": "https://meta.comcast.com/firebolt/types#/definitions/ListenResponse"
                            }
                        ]
                    }
                }
            }
            openRpc.methods.push(openRpcMethod)
        })
    }

    const tree = (obj, path='#') => {
        const items = []
        items.push([path, obj])
        // Arrays probably are overkill, but might as well...
        if (obj) {
            if (Array.isArray(obj)) {
                for (var i=0; i< obj.length; i++) {
                    items.push(...tree(obj[i], path + '/' + i))
                }
            }
            else if (typeof obj === 'object') {
                const keys = Object.keys(obj)
                for (var i=0; i<keys.length; i++) {
                    items.push(...tree(obj[keys[i]], path + '/' + keys[i]))
                }
            }
        }
        return items
    }

    const set = (obj, path, value) => {
        // drop #/ and split on /
        const parts = path.substr(2).split('/')
        const key = parts.pop()
        
        if (!key || key === "") {
            console.log(`ERROR: bad key name ${key} from ${path}`)
            throw `ERROR: bad key name ${key} from ${path}`
        }

        parts.forEach(p => obj = obj[p])
        if (obj[key]) {
            // skip, it's already here
        }
        else {
            obj[key] = value
        }
    }

    if (json.definitions) {
        openRpc.components = {
            schemas: JSON.parse(JSON.stringify(json.definitions))
        }

        tree(json.definitions).forEach(([path, schema]) => {
            if (path !== '#') {
                replaceRef('#/definitions/' + path.substr(2), '#/components/schemas/' + path.substr(2), openRpc)
                // NOTE: this is due to malformed $refs in RDK Services!
                replaceRef('#definitions/' + path.substr(2), '#/components/schemas/' + path.substr(2), openRpc)
            }
        })
    }
    else {
        openRpc.components = {
        }
    }

    if (json.common) {
        if (openRpc.components && !openRpc.components.schemas) {
            openRpc.components.schemas = JSON.parse(JSON.stringify(json.common))
        }
        else {
            tree(json.common).forEach(([path, schema]) => {
                if (path !== '#') {
                    set(openRpc.components.schemas, path, schema)
                replaceRef('#/common/' + path.substr(2), '#/components/schemas/' + path.substr(2), openRpc)
                // NOTE: this is due to malformed $refs in RDK Services!
                replaceRef('#common/' + path.substr(2), '#/components/schemas/' + path.substr(2), openRpc)
                }
            })
        }
    }

    if (json.common && json.definitions) {
        const paths = array => array.map(([path, schema]) => path)
        const intersection = paths(tree(json.common)).filter(value => paths(tree(json.definitions)).includes(value))
        if (intersection.length > 1) {
            console.error(`ERROR: Schema has the same path in both 'common' and 'definitions': \n\t - ` + intersection.slice(1).join('\n\t - ') + '\n')
        }
    }

    if (openRpc.components.schemas) {
        tree(openRpc.components.schemas).forEach(([path, schema]) => {
            if (path !== '#') {
                if (!path.split('/').includes('properties') && !path.split('/').includes('additionalProperties')) {
                    if (schema) {
                        if (schema.type || schema['$ref']) {
                            schema.title = path.split('/').pop()
                        }
                    }
                }
            }
        })
    }

    return openRpc
}