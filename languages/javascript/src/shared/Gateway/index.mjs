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

Transport.receive(async (json) => {
    // console.debug('Received message from transport: \n' + JSON.stringify(json, { indent: '\t'}))
    if (Settings.getLogLevel() === 'DEBUG') {
        console.debug('Receiving message from transport: \n' + JSON.stringify(json, { indent: '\t'}))
    }
        
    if (json.method) {
        if (json.id) {
            Server.request(json.id, json.method, json.params)
        }
        else {
            Server.notify(json.method, json.params)
        }
    }
    else if (json.id) {
        Client.response(json.id, json.result, json.error)
    }
})

export async function request(method, params) {
    if (Array.isArray(method)) {
        return await Client.bulk(method)
    }
    else {
        return await Client.request(method, params)
    }
}

export function subscribe(event, callback) {
    Server.subscribe(event, callback)
}

export function unsubscribe(event) {
    Server.subscribe(event)
}

export function provide(interfaceName, provider) {
    Server.provide(interfaceName, provider)
}

export function deprecate (method, alternative) {
    Client.deprecate(method, alternative)
}


export default {
    request,
    subscribe,
    unsubscribe,
    provide,
    deprecate
}