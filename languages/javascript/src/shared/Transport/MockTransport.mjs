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


const win = typeof window !== 'undefined' ? window : {}

let listener
export const setMockListener = func => { listener = func }

let mock
const pending = []

let callback
let testHarness

if (win.__firebolt && win.__firebolt.testHarness) {
  testHarness = win.__firebolt.testHarness
}

function send(json) {
  // handle bulk sends
  if (Array.isArray(json)) {
    json.forEach(send)
    return
  }

  if (json.method) {
    let [module, method] = json.method.split('.')

    if (testHarness && testHarness.onSend) {
      testHarness.onSend(module, method, json.params, json.id)
    }
  
    if (mock)
      handle(json)
    else
      pending.push(json)  
  }
  else if (json.id !== undefined && requests[json.id]) {
    const promise = requests[json.id]
    if (json.result !== undefined) {
      promise.resolve(json.result)
    }
    else {
      promise.reject(json.error)
    }
  }

}

function handle(json) {
  let result
  try {
    result = getResult(json.method, json.params)
  }
  catch (error) {
    setTimeout(() => callback({ 
      jsonrpc: '2.0',
      error: {
        code: -32602,
        message: "Invalid params (this is a mock error from the mock transport layer)"
      },
      id: json.id
    }))
  }

  setTimeout(() => callback({ 
    jsonrpc: '2.0',
    result: result,
    id: json.id
  }))
}

function receive(_callback) {
  callback = _callback

  if (testHarness && (typeof testHarness.initialize === 'function')) {
    testHarness.initialize({
      emit: event,
      listen: function(...args) { listener(...args) },
    })
  }
}

function event(module, event, value) {
  callback({
    jsonrpc: '2.0',
    method: `${module}.${event}`,
    params: [
      {
        name: 'value',
        value: value
      }
    ]
  })
}

let id = 0
const requests = []

function request(method, params) {
  const promise = new Promise( (resolve, reject) => {
    requests[id] = { resolve, reject }
  })
  callback({
    jsonrpc: '2.0',
    id: id,
    method: `${method}`,
    params: params
  })

  return promise
}

function dotGrab(obj = {}, key) {
  const keys = key.split('.')
  let ref = obj
  for (let i = 0; i < keys.length; i++) {
    ref = (Object.entries(ref).find( ([k, v]) => k.toLowerCase() === keys[i].toLowerCase()) || [null, {}])[1]
  }
  return ref
}

function getResult(method, params) {
  let api = dotGrab(mock, method)

  if (method.match(/^[a-zA-Z]+\.on[A-Za-z]+$/)) {
    api = {
      event: method,
      listening: true
    }
  }

  if (typeof api === 'function') {
    let result = params == null ? api() : api(params)
    if (result === undefined) {
      result = null
    }
    return result
  } else return api
}

export function setMockResponses(m) {
  mock = m

  pending.forEach(json => handle(json))
  pending.length = 0
}

export default {
  send: send,
  receive: receive,
  event: event,
  request: request
}

