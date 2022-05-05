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

import Transport from '../Transport/index.mjs'
import Events from '../Events/index.mjs'

const providerInterfaces = {}

export const registerProviderInterface = (capability, module, methods) => {
  if (providerInterfaces[capability]) {
    throw `Capability ${capability} has multiple provider interfaces registered.`
  }

  methods.forEach(m => m.name = `${module}.${m.name}`)
  providerInterfaces[capability] = methods.concat()
}

const provide = function(capability, provider) {
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(provider)).filter(item => {
    return typeof provider[item] === 'function' && item != 'constructor'
  })

  const iface = providerInterfaces[capability]

  iface.forEach(imethod => {
    const parts = imethod.name.split('.')
    const method = parts.pop();
    const module = parts.pop().toLowerCase();

    const defined = !!methods.find(m => method) 

    Events.listen(module, `request${method}`, async function (request) {
      await provider[method].apply(provider, [
        request,
        response => {
          Transport.send(module)
        }
      ])
    })
  })

  for (let i = 0; i < methods.length; i++) {
    const name = methods[i].charAt(0).toUpperCase() + methods[i].slice(1);
    if (pms.indexOf(methods[i]) !== -1) {
      Events.listen(module, 'request' + name, async function (req) {
        const fn = provider[methods[i]]
        const providerCallArgs = [req.request, resp => {
          Transport.send(module, methods[i] + 'Response', {
            correlationId: req.correlationId,
            response: resp
          })
        }]
        await fn.apply(provider, providerCallArgs)
        Transport.send(module, methods[i] + 'Ready', {
          correlationId: req.correlationId
        })
      })
    } else {
      console.warn("Ignoring unknown provider method '" + module + '.' + methods[i] + "'")
    }
  }
}

export default {
  provide
}
