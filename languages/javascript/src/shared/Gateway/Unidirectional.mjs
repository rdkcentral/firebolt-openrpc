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

import mock from '../Transport/MockTransport.mjs';
import Queue from '../Transport/queue.mjs';
import Settings, { initSettings } from '../Settings/index.mjs';
import LegacyTransport from '../Transport/LegacyTransport.mjs';
import WebsocketTransport from '../Transport/WebsocketTransport.mjs';
import Results from '../Results/index.mjs';

const LEGACY_TRANSPORT_SERVICE_NAME = 'com.comcast.BridgeObject_1';
let moduleInstance = null;

const isEventSuccess = (x) => x && typeof x.event === 'string' && typeof x.listening === 'boolean';

const win = typeof window !== 'undefined' ? window : {};

export default class Transport {
  constructor() {
    this._promises = [];
    this._transport = null;
    this._id = 1;
    this._subscribers = [];
    this._eventIds = {};
    this._queue = new Queue();
    this._deprecated = {};
    this.isMock = false;
  }

  static registerDeprecatedMethod(module, method, alternative) {
    Transport.get()._deprecated[module.toLowerCase() + '.' + method.toLowerCase()] = {
      alternative: alternative || '',
    };
  }

  _endpoint() {
    if (win.__firebolt && win.__firebolt.endpoint) {
      return win.__firebolt.endpoint;
    }
    return null;
  }

  constructTransportLayer() {
    let transport;
    const endpoint = this._endpoint();
    if (endpoint && (endpoint.startsWith('ws://') || endpoint.startsWith('wss://'))) {
      transport = new WebsocketTransport(endpoint);
      transport.receive(this.receiveHandler.bind(this));
    } else if (
      typeof win.ServiceManager !== 'undefined' &&
      win.ServiceManager &&
      win.ServiceManager.version
    ) {
      // Wire up the queue
      transport = this._queue;
      // get the default bridge service, and flush the queue
      win.ServiceManager.getServiceForJavaScript(LEGACY_TRANSPORT_SERVICE_NAME, (service) => {
        if (LegacyTransport.isLegacy(service)) {
          transport = new LegacyTransport(service);
        } else {
          transport = service;
        }
        this.setTransportLayer(transport);
      });
    } else {
      this.isMock = true;
      transport = mock;
      transport.receive(this.receiveHandler.bind(this));
    }
    return transport;
  }

  setTransportLayer(tl) {
    this._transport = tl;
    this._queue.flush(tl);
  }

  static request(method, params, transforms) {
    /** Transport singleton across all SDKs to keep single id map */
    console.dir(method);

    const module = method.split('.')[0];
    method = method.split('.')[1];

    if (method.match(/^on[A-Z]/) && params.listen !== undefined) {
      const { id, promise } = Transport.get()._sendAndGetId(module, method, params, transforms);
      const notifier = `${module}.${method.charAt(2).toLowerCase() + method.substring(3)}`;
      if (params.listen) {
        Transport.get()._eventIds[id] = notifier;
      } else {
        delete Transport.get()._eventIds[id];
        delete Transport.get()._subscribers[notifier];
      }
      return promise;
    } else {
      return Transport.get()._send(module, method, params, transforms);
    }
  }

  static subscribe(method, listener) {
    const module = method.split('.')[0];
    method = method.split('.')[1];
    const notifier = `${module}.${method}`;
    Transport.get()._subscribers[notifier] = Transport.get()._subscribers[notifier] || [];
    Transport.get()._subscribers[notifier].push(listener);
    return;
  }

  static unsubscribe(method) {
    // TODO: implement
  }

  static simulate(method, value) {
    console.log(`simulate(${method})`);
    const module = method.split('.')[0];
    method = method.split('.')[1];
    const notifier = `${module}.${method}`;
    Transport.get()._subscribers[notifier].forEach((callback) => callback(value));
  }

  static deprecate() {
    // TODO: implement
  }

  _send(module, method, params, transforms) {
    if (Array.isArray(module) && !method && !params) {
      return this._batch(module);
    } else {
      return this._sendAndGetId(module, method, params, transforms).promise;
    }
  }

  _sendAndGetId(module, method, params, transforms) {
    const { promise, json, id } = this._processRequest(module, method, params, transforms);
    const msg = JSON.stringify(json);
    if (Settings.getLogLevel() === 'DEBUG') {
      console.debug('Sending message to transport: ' + msg);
    }
    this._transport.send(msg);

    return { id, promise };
  }

  _batch(requests) {
    const results = [];
    const json = [];

    requests.forEach(({ module, method, params, transforms }) => {
      const result = this._processRequest(module, method, params, transforms);
      results.push({
        promise: result.promise,
        id: result.id,
      });
      json.push(result.json);
    });

    const msg = JSON.stringify(json);
    if (Settings.getLogLevel() === 'DEBUG') {
      console.debug('Sending message to transport: ' + msg);
    }
    this._transport.send(msg);

    return results;
  }

  _processRequest(module, method, params, transforms) {
    const p = this._addPromiseToQueue(module, method, params, transforms);
    const json = this._createRequestJSON(module, method, params);

    const result = {
      promise: p,
      json: json,
      id: this._id,
    };

    this._id++;

    return result;
  }

  _createRequestJSON(module, method, params) {
    return {
      jsonrpc: '2.0',
      method: module.toLowerCase() + '.' + method,
      params: params,
      id: this._id,
    };
  }

  _addPromiseToQueue(module, method, params, transforms) {
    return new Promise((resolve, reject) => {
      this._promises[this._id] = {};
      this._promises[this._id].promise = this;
      this._promises[this._id].resolve = resolve;
      this._promises[this._id].reject = reject;
      this._promises[this._id].transforms = transforms;

      const deprecated = this._deprecated[module.toLowerCase() + '.' + method.toLowerCase()];
      if (deprecated) {
        console.warn(`WARNING: ${module}.${method}() is deprecated. ` + deprecated.alternative);
      }
    });
  }

  /**
   * If we have a global transport, use that. Otherwise, use the module-scoped transport instance.
   * @returns {Transport}
   */
  static get() {
    /** Set up singleton and initialize it */
    win.__firebolt = win.__firebolt || {};
    if (win.__firebolt.transport == null && moduleInstance == null) {
      const transport = new Transport();
      transport.init();
      if (transport.isMock) {
        /** We should use the mock transport built with the SDK, not a global */
        moduleInstance = transport;
      } else {
        win.__firebolt = win.__firebolt || {};
        win.__firebolt.transport = transport;
      }
      win.__firebolt.setTransportLayer = transport.setTransportLayer.bind(transport);
    }
    return win.__firebolt.transport ? win.__firebolt.transport : moduleInstance;
  }

  receiveHandler(message) {
    if (Settings.getLogLevel() === 'DEBUG') {
      console.debug('Received message from transport: ' + message);
    }
    const json = JSON.parse(message);
    const p = this._promises[json.id];

    if (p) {
      if (json.error) p.reject(json.error);
      else {
        // Do any module-specific transforms on the result
        let result = json.result;

        if (p.transforms) {
          if (Array.isArray(json.result)) {
            result = result.map((x) => Results.transform(x, p.transforms));
          } else {
            result = Results.transform(result, p.transforms);
          }
        }

        p.resolve(result);
      }
      delete this._promises[json.id];
    }

    // event responses need to be emitted, even after the listen call is resolved
    if (this._eventIds[json.id] && !isEventSuccess(json.result)) {
      this._subscribers[this._eventIds[json.id]].forEach((callback) => callback(json.result));
    }
  }

  init() {
    initSettings({}, { log: true });
    this._queue.receive(this.receiveHandler.bind(this));
    if (win.__firebolt) {
      if (win.__firebolt.mockTransportLayer === true) {
        this.isMock = true;
        this.setTransportLayer(mock);
      } else if (win.__firebolt.getTransportLayer) {
        this.setTransportLayer(win.__firebolt.getTransportLayer());
      }
    }
    if (this._transport == null) {
      this._transport = this.constructTransportLayer();
    }
  }
}
win.__firebolt = win.__firebolt || {};
win.__firebolt.setTransportLayer = (transport) => {
  Transport.get().setTransportLayer(transport);
};
