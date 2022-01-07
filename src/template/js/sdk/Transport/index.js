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

import { default as mock, setMockListener } from './mock.js'
import { default as queue } from './queue.js'
import Settings, { initSettings } from '../Settings/index.js'
import LegacyTransport from './LegacyTransport.js'
import { default as win } from '../Transport/global'
import WebsocketTransport from './WebsocketTransport.js'

// TODO need to spec Firebolt Settings
initSettings({}, { log: true })

const promises = []
let transport
let id = 1
let transport_service_name = 'com.comcast.BridgeObject_1'
let timeout
let emit

export const setEmitter = (func) => emit = func
export const setListener = (func) => { setMockListener(func) }

export const event_map = {}

// create global handshake namespace
if (!win.__firebolt) {
  win.__firebolt = {}
}

const _endpoint = () => {
  if (win.__firebolt && win.__firebolt.endpoint) {
    return win.__firebolt.endpoint
  }
  return null
}

// Returns an FTL queue. Initializes the default transport layer if available
const getTransportLayer = () => {
  let transport
  if (typeof win.__firebolt.transport_service_name === 'string')
    transport_service_name = win.__firebolt.transport_service_name

  const endpoint = _endpoint()
  if (endpoint && (endpoint.startsWith('ws://') || endpoint.startsWith('wss://'))) {
    transport = new WebsocketTransport(endpoint)
    setTransportLayer(transport)
  } else if (
    typeof win.ServiceManager !== 'undefined' &&
    win.ServiceManager &&
    win.ServiceManager.version
  ) {
    // Wire up the queue
    transport = queue
    // get the default bridge service, and flush the queue
    win.ServiceManager.getServiceForJavaScript(transport_service_name, service => {
      if (LegacyTransport.isLegacy(service)) {
        transport = new LegacyTransport(service)
      } else {
        transport = service
      }
      setTransportLayer(transport)
    })
  } else {
    // Check for custom, or fall back to mock
    transport = queue
    
    // in 500ms, default to the mock FTL
    // TODO: design a better way to load mock
    timeout = setTimeout(() => {
      console.log("Setting up mock transport layer")
      setTransportLayer(mock)
    }, 500)

  }
  return transport
}

const setTransportLayer = tl => {
  if (timeout) clearTimeout(timeout)

  // remove handshake object
  delete win.__firebolt

  transport = tl
  queue.flush(tl)
}

const send = (module, method, params) => {
  let p = new Promise((resolve, reject) => {
    promises[id] = {}
    promises[id].promise = this
    promises[id].resolve = resolve
    promises[id].reject = reject

    // store the ID of the first listen for each event
    // TODO: what about wild cards?
    if (method.match(/^on[A-Z]/)) {
      //onEventName(true)
      if (params.listen) {
        event_map[id] = module.toLowerCase() + '.' + method[2].toLowerCase() + method.substr(3)
      }
      //onEventName(false)
      else {
        Object.keys(event_map).forEach( key => {
          if (event_map[key] === module.toLowerCase() + '.' + method[2].toLowerCase() + method.substr(3)) {
            delete event_map[key]
          }
        })
      }
    }
  })

  let json = { jsonrpc: '2.0', method: module + '.' + method, params: params, id: id }
  id++

  const msg = JSON.stringify(json)
  if (Settings.getLogLevel() === 'DEBUG') {
    console.debug('Sending message to transport: ' + msg)
  }
  transport.send(msg)

  return p
}

const is_event_success = x => x && (typeof x.event === 'string') && (typeof x.listening === 'boolean')

const receive_handler = message => {
  if (Settings.getLogLevel() === 'DEBUG') {
    console.debug('Received message from transport: ' + message)
  }
  let json = JSON.parse(message)
  let p = promises[json.id]

  if (p) {
    if (json.error) p.reject(json.error)
    else {
      p.resolve(json.result)
    }
    delete promises[json.id]
  }

  // event responses need to be emitted, even after the listen call is resolved
  if (event_map[json.id] && !is_event_success(json.result)) {
    const moduleevent = event_map[json.id]
    if (moduleevent) {
      emit(moduleevent.split('.')[0], moduleevent.split('.')[1], json.result)
    }
  }
}

transport = getTransportLayer()

// TODO: clean up resolved promises
transport.receive(receive_handler)

if (win.__firebolt) {
  if (win.__firebolt.mockTransportLayer === true) {
    setTransportLayer(mock)
  }
  else if (win.__firebolt.getTransportLayer) {
    setTransportLayer(win.__firebolt.getTransportLayer())
  } else {
    win.__firebolt.setTransportLayer = setTransportLayer
  }
}

export default {
  send: send

}
