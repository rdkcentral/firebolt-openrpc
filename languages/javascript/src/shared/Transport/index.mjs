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

import MockTransport from './MockTransport.mjs'
import Settings, { initSettings } from '../Settings/index.mjs'
import WebsocketTransport from './WebsocketTransport.mjs'

const win = typeof window !== 'undefined' ? window : {}
win.__firebolt = win.__firebolt || {}

initSettings({}, { log: true })

let implementation
let _callback

export function send(json) {
  implementation = getImplementation()

  if (Settings.getLogLevel() === 'DEBUG') {
    console.debug('Sending message to transport: \n' + JSON.stringify(json, { indent: '\t'}))
  }

  implementation.send(JSON.stringify(json))
}

export function receive(callback) {
  if (implementation) {
    implementation.receive(callback)
  }
  else {
    _callback = callback
  }
}

function getImplementation() {
  if (implementation) {
    return implementation
  }
  
  if (win.__firebolt.transport) {
    implementation = win.__firebolt.transport
  }
  else if (win.__firebolt.endpoint) {
    // Only adds RPCv2=true query parameter when using bidirectional SDK.
    // This parameter will not be present when using unidirectional SDK.
    // Unidirectional endpoint is handled in Gateway/Unidirectional.mjs
    const endpoint = win.__firebolt.endpoint
    const url = endpoint + (endpoint.includes('?') ? '&' : '?') + 'RPCv2=true'
    implementation = new WebsocketTransport(url)
  }
  else {
    implementation = MockTransport
  }
  
  win.__firebolt.transport = implementation
  implementation.receive(_callback)
  
  _callback = undefined

  return implementation
}

export default {
  send,
  receive
}