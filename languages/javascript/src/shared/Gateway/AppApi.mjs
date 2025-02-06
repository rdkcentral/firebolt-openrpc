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

import Transport from '../Transport/index.mjs';

const win = typeof window !== 'undefined' ? window : {};
win.__firebolt = win.__firebolt || {};

// JSON RPC id generator, to be shared across all SDKs
class JsonRpcIdIterator {
  constructor() {
    this._id = 1;
  }
  getJsonRpcId() {
    return this._id++;
  }
}

let idGenerator = win.__firebolt.idGenerator || new JsonRpcIdIterator();
win.__firebolt.idGenerator = idGenerator;

const promises = {};
const deprecated = {};

// request = { method: string, params: object, id: boolean }[]
// request with no `id` property are assumed to NOT be notifications, i.e. id must be set to false explicitly
export async function batch(requests) {
  if (Array.isArray(requests)) {
    const processed = requests.map((req) =>
      processRequest(req.method, req.params, req.id, req.id === false),
    );

    // filter requests exclude notifications, as they don't need promises
    const promises = processed
      .filter((req) => req.id)
      .map((request) => addPromiseToQueue(request.id));

    Transport.send(processed);

    // Using Promise.all get's us batch blocking for free
    return Promise.all(promises);
  }
  throw `Bulk requests must be in an array`;
}

// Request that the server provide fulfillment of an method
export async function request(method, params) {
  const json = processRequest(method, params);
  const promise = addPromiseToQueue(json.id);
  Transport.send(json);
  return promise;
}

export function notify(method, params) {
  Transport.send(processRequest(method, params, true));
}

export function response(id, result, error) {
  const promise = promises[id];

  if (promise) {
    if (result !== undefined) {
      promises[id].resolve(result);
    } else if (error !== undefined) {
      promises[id].reject(error);
    }

    // TODO make sure this works
    delete promises[id];
  } else {
    throw `Received a response for an unidentified request ${id}`;
  }
}

export function deprecate(method, alternative) {
  deprecated[method] = alternative;
}

function addPromiseToQueue(id) {
  return new Promise((resolve, reject) => {
    promises[id] = {};
    promises[id].promise = this;
    promises[id].resolve = resolve;
    promises[id].reject = reject;
  });
}

function processRequest(method, params, notification = false) {
  if (deprecated[method]) {
    console.warn(`WARNING: ${method}() is deprecated. ` + deprecated[method]);
  }

  const id = !notification && idGenerator.getJsonRpcId();
  const jsonrpc = '2.0';
  const json = { jsonrpc, method, params };

  !notification && (json.id = id);

  return json;
}

export default {
  request,
  batch,
  response,
  deprecate,
};
