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

import Transport from '../Transport'
import { setMockListener } from '../Transport/mock.js'

let listenerId = 0

// holds a map of ${module}.${event} => listenerId, e.g. callback method id
// note that one callback can listen to multiple events, e.g. 'discovery.*'
const listeners = {}

// holds a map of ${module}.${event} => Transport.send calls (only called once per event)
// note that the keys here MUST NOT contain wild cards
const enabledEvents = {}

const oncers = []
const validEvents = {}

export const emit = (module, event, value) => {
  callCallbacks(listeners[module + '.*'], [event, value])
  callCallbacks(listeners[module + '.' + event], [value])
}

Transport.addEventEmitter(emit)

export const registerEvents = (module, events) => {
  validEvents[module.toLowerCase()] = events.concat()
}

const callCallbacks = (cbs, args) => {
  cbs &&
    Object.keys(cbs).forEach(listenerId => {
      let callback = cbs[listenerId]
      if (oncers.indexOf(parseInt(listenerId)) >= 0) {
        oncers.splice(oncers.indexOf(parseInt(listenerId)), 1)
        delete cbs[listenerId]
      }
      callback.apply(null, args)
    })
}

const doListen = function(module, event, callback, once) {
  if (typeof callback !== 'function') {
    return Promise.reject('No valid callback function provided.')
  } else {
    if (module === '*') {
      return Promise.reject('No valid module name provided')
    }

    let events = (event === '*' ? validEvents[module] : [event]) // explodes wildcards into an array
    let promises = []
    const key = module + '.' + event // this might be a wildcard, e.g. 'lifecycle.*'
    listenerId++
    listeners[key] = listeners[key] || {}
    listeners[key][''+listenerId] = callback

    if (once) {
      oncers.push(listenerId)
    }

    events.forEach(event => {
      // Check each event, and only turn on events (not wildcards) that are off
      if (!enabledEvents[module + '.' + event]) {
        promises.push(
          Transport.send(module, 'on' + event[0].toUpperCase() + event.substr(1), { listen: true })
        )
        enabledEvents[module + '.' + event] = true
      }
    })

    let resolve, reject
    let p = new Promise((res, rej) => {
      resolve = res
      reject = rej
    })

    if (promises.length) {
      Promise.all(promises).then(responses => {
        resolve(listenerId)
      }).catch(error => {
        // Promise.all rejects if at least one promise rejects... we don't want that behavior here
        // TODO: Do something better than fail silently
        if (event === '*') {
          resolve(listenerId)
        }
        else {
          reject(error)
        }
      })
    }
    else {
      resolve(listenerId)
    }

    return p
  }
}

const getListenArgs = function(...args) {
  const callback = args.pop()
  const module = args[0].toLowerCase() || '*'
  const event = args[1] || '*'
  return [module, event, callback]
}

const once = function(...args) {
  const [module, event, callback] = getListenArgs(...args)
  return doListen(module, event, callback, true)
}

const listen = function(...args) {
  const [module, event, callback] = getListenArgs(...args)
  return doListen(module, event, callback, false)
}

setMockListener(listen)

export default {
  listen: listen,
  once: once,
  // TODO: clear needs to go through Transport Layer
  clear(moduleOrId = false, event = false) {
    if (typeof moduleOrId === 'number') {
      const searchId = moduleOrId.toString()
      Object.keys(listeners).every(key => {
        if (listeners[key][searchId]) {
          // delete callback
          delete listeners[key][searchId]
          // delete the whole namespace if it was the only callback
          if (Object.keys(listeners[key]).length === 0) {
            delete listeners[key]
          }
          return false
        }
        return true
      })
    } else {
      if (!moduleOrId && !event) {
        Object.keys(listeners).forEach(key => {
          delete listeners[key]
        })
      } else if (!event) {
        Object.keys(listeners).forEach(key => {
          if (key.indexOf(moduleOrId.toLowerCase()) === 0) {
            delete listeners[key]
          }
        })
      } else {
        delete listeners[moduleOrId + '.' + event]
      }
    }
  },
  broadcast(event, value) {
    emit('app', event, value)
  },
}
