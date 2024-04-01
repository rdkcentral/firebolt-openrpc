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

import Transport from "../Transport/index.mjs"

const providers = {}
const listeners = {}
const interfaces = {}

// Request that the app provide fulfillment of an method
export async function request(id, method, params, transforms) {
    let result, error
    try {
        result = await getProviderResult(method, params)
    } 
    catch (e) {
        error = e
    }

    const response = {
        jsonrpc: '2.0',
        id: id
    }

    result && (response.result = result)
    error && (response.error = error)

    Transport.send(response)
}

export async function notify(method, params) {
    if (listeners[method]) {
        listeners[method](params)
        return
    }
    throw `Notification not implemented: ${method}`
}

// Register a provider implementation with an interface name
export function provide(interfaceName, provider, methods) {
    providers[interfaceName] = provider
    interfaces[interfaceName] = methods
}

// Register a notification listener with an event name
export function subscribe(event, callback) {
    listeners[event] = callback
}

export function unsubscribe(event) {
    delete listeners[event]
}

async function getProviderResult(method, params) {
    const split = method.split('.')
    method = split.pop()
    const interfaceName = split.join('.')

    if (providers[interfaceName]) {
        if (providers[interfaceName][method]) {
            // sort the params into an array based on the interface parameter order
            const parameters = interfaces[interfaceName].find(m => m.name === method).parameters.map(p => params[p]).filter(p => p !== undefined)
            return await providers[interfaceName][method](...parameters)
        }
        throw `Method not implemented: ${method}`
    }
    throw `Interface not provided: ${interfaceName}`
}


export default {
    request,
    notify,
    provide,
    subscribe,
    unsubscribe
}
