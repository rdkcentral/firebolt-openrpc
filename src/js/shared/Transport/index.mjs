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

import mock from './MockTransport.mjs'
import Queue from './queue.mjs'
import Settings, { initSettings } from '../Settings/index.mjs'
import LegacyTransport from './LegacyTransport.mjs'
import win from '../Transport/global.mjs'
import WebsocketTransport from './WebsocketTransport.mjs'

const LEGACY_TRANSPORT_SERVICE_NAME = 'com.comcast.BridgeObject_1'
let moduleInstance = null

const isEventSuccess = x => x && (typeof x.event === 'string') && (typeof x.listening === 'boolean')

export default class Transport {
  constructor () {
    this._promises = []
    this._transport = null
    this._id = 1
    this._eventEmitters = []
    this._eventMap = {}
    this._queue = new Queue()
    this._deprecated = {}
    this.isMock = false
  }

  static addEventEmitter (emitter) {
    Transport.get()._eventEmitters.push(emitter)
  }

  static registerDeprecatedMethod (module, method, alternative) {
    Transport.get()._deprecated[module.toLowerCase() + '.' + method.toLowerCase()] = {
      alternative: alternative || ''
    }
  }

  _endpoint () {
    if (win.__firebolt && win.__firebolt.endpoint) {
      return win.__firebolt.endpoint
    }
    return null
  }

  constructTransportLayer () {
    let transport
    const endpoint = this._endpoint()
    if (endpoint && (endpoint.startsWith('ws://') || endpoint.startsWith('wss://'))) {
      transport = new WebsocketTransport(endpoint)
      transport.receive(this.receiveHandler.bind(this))
    } else if (
      typeof win.ServiceManager !== 'undefined' &&
      win.ServiceManager &&
      win.ServiceManager.version
    ) {
      // Wire up the queue
      transport = this._queue
      // get the default bridge service, and flush the queue
      win.ServiceManager.getServiceForJavaScript(LEGACY_TRANSPORT_SERVICE_NAME, service => {
        if (LegacyTransport.isLegacy(service)) {
          transport = new LegacyTransport(service)
        } else {
          transport = service
        }
        this.setTransportLayer(transport)
      })
    } else {
      this.isMock = true
      transport = mock
      transport.receive(this.receiveHandler.bind(this))
    }
    return transport
  }

  setTransportLayer (tl) {
    this._transport = tl
    this._queue.flush(tl)
  }

  static send (module, method, params) {
    /** Transport singleton across all SDKs to keep single id map */
    return Transport.get()._send(module, method, params)
  }

  _send (module, method, params) {
    const p = new Promise((resolve, reject) => {
      this._promises[this._id] = {}
      this._promises[this._id].promise = this
      this._promises[this._id].resolve = resolve
      this._promises[this._id].reject = reject

      const deprecated = this._deprecated[module.toLowerCase() + '.' + method.toLowerCase()]
      if (deprecated) {
        console.warn(`WARNING: ${module}.${method}() is deprecated. ` + deprecated.alternative)
      }

      // store the ID of the first listen for each event
      // TODO: what about wild cards?
      if (method.match(/^on[A-Z]/)) {
        if (params.listen) {
          this._eventMap[this._id] = module.toLowerCase() + '.' + method[2].toLowerCase() + method.substr(3)
        } else {
          Object.keys(this._eventMap).forEach(key => {
            if (this._eventMap[key] === module.toLowerCase() + '.' + method[2].toLowerCase() + method.substr(3)) {
              delete this._eventMap[key]
            }
          })
        }
      }
    })

    const json = { jsonrpc: '2.0', method: module + '.' + method, params: params, id: this._id }
    this._id++

    const msg = JSON.stringify(json)
    if (Settings.getLogLevel() === 'DEBUG') {
      console.debug('Sending message to transport: ' + msg)
    }
    this._transport.send(msg)

    return p
  }

  static getEventMap () {
    return Transport.get()._eventMap
  }

  /**
   * If we have a global transport, use that. Otherwise, use the module-scoped transport instance.
   * @returns {Transport}
   */
  static get () {
    return win.__firebolt.transport ? win.__firebolt.transport : moduleInstance
  }

  receiveHandler (message) {
    if (Settings.getLogLevel() === 'DEBUG') {
      console.debug('Received message from transport: ' + message)
    }
    const json = JSON.parse(message)
    const p = this._promises[json.id]

    if (p) {
      if (json.error) p.reject(json.error)
      else {
        p.resolve(json.result)
      }
      delete this._promises[json.id]
    }

    // event responses need to be emitted, even after the listen call is resolved
    if (this._eventMap[json.id] && !isEventSuccess(json.result)) {
      const moduleevent = this._eventMap[json.id]
      if (moduleevent) {
        this._eventEmitters.forEach(emit => {
          emit(moduleevent.split('.')[0], moduleevent.split('.')[1], json.result)
        })
      }
    }
  }

  init () {
    initSettings({}, { log: true })
    this._queue.receive(this.receiveHandler.bind(this))
    if (win.__firebolt) {
      if (win.__firebolt.mockTransportLayer === true) {
        this.isMock = true
        this.setTransportLayer(mock)
      } else if (win.__firebolt.getTransportLayer) {
        this.setTransportLayer(win.__firebolt.getTransportLayer())
      }
    }
    if (this._transport == null) {
      this._transport = this.constructTransportLayer()
    }
  }
}

/** Set up singleton and initialize it */
win.__firebolt = win.__firebolt || {}
if ((win.__firebolt.transport == null) && (moduleInstance == null)) {
  const transport = new Transport()
  transport.init()
  if (transport.isMock) {
    /** We should use the mock transport built with the SDK, not a global */
    moduleInstance = transport
  } else {
    win.__firebolt = win.__firebolt || {}
    win.__firebolt.transport = transport
  }
  win.__firebolt.setTransportLayer = transport.setTransportLayer.bind(transport)
}
