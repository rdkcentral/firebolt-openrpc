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

import Server from "./Server.mjs"
import Client from "./Client.mjs"
import Transport from "../Transport/index.mjs"
import Settings from "../Settings/index.mjs"

Transport.receive(async (message) => {
    const json = JSON.parse(message)
    if (Array.isArray(json)) {
        json.forEach(message => processMessage(message))
    }
    else {
        processMessage(json)
    }
})

function processMessage(json) {
    if (Settings.getLogLevel() === 'DEBUG') {
        console.debug('Receiving message from transport: \n' + JSON.stringify(json, { indent: '\t'}))
    }
        
    if (json.method !== undefined) {
        if (json.id !== undefined) {
            Server.request(json.id, json.method, json.params)
        }
        else {
            Server.notify(json.method, json.params)
        }
    }
    else if (json.id !== undefined) {
        Client.response(json.id, json.result, json.error)
    }
}

export async function batch(requests) {
    if (Array.isArray(requests)) {
        return await Client.batch(requests)
    }
    else {
        throw "Gateway.batch() requires an array of requests: { method: String, params: Object, id: Boolean }"
    }
}

export async function request(method, params) {
    if (Array.isArray(method)) {
        throw "Use Gateway.batch() for batch requests."
    }
    else {
        return await Client.request(method, params)
    }
}

export async function notify(method, params) {
    if (Array.isArray(method)) {
        throw "Use Gateway.batch() for batch requests."
    }
    else {
        return await Client.notify(method, params)
    }
}

export function subscribe(event, callback) {
    Server.subscribe(event, callback)
}

export function unsubscribe(event) {
    Server.unsubscribe(event)
}

export function simulate(event, value) {
    Server.simulate(event, value)
}

export function provide(interfaceName, provider) {
    Server.provide(interfaceName, provider)
}

export function deprecate(method, alternative) {
    Client.deprecate(method, alternative)
}

export default {
    request,
    notify,
    batch,
    subscribe,
    unsubscribe,
    simulate,
    provide,
    deprecate
}