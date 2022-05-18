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

import { Provider } from '../../build/sdk/javascript/src/sdk.mjs'
import { transport } from '../Setup.js'

let providerMethodNotificationRegistered = false
let providerMethodRequestDispatched = false
let providerMethodResultSent = false
let providerMethodReadySent = false
let methodSession
let numberOfArgs = -1
let value
let responseCorrelationId


beforeAll( () => {

    class SimpleProvider {
        handshakeMethod(...args) {
            numberOfArgs = args.length
            methodSession = args[1]
            // call 'focus'
            methodSession.focus()
            return Promise.resolve('a value!')
        }
    }
    
    transport.onSend(json => {
        if (json.method === 'provider.onRequestHandshakeMethod') {
            providerMethodNotificationRegistered = true

            // Confirm the listener is on
            transport.response(json.id, {
                listening: true,
                event: json.method
            })

            // send out a request event
            setTimeout( _ => {
                providerMethodRequestDispatched = true
                transport.response(json.id, {
                    correlationId: 123
                })
            })
        }
        else if (json.method === 'provider.handshakeMethodFocus') {
            providerMethodReadySent = true
        }
        else if (json.method === 'provider.handshakeMethodResponse') {
            providerMethodResultSent = true
            value = json.params.result
            responseCorrelationId = json.params.correlationId
        }
    })

    Provider.provide('xrn:firebolt:capability:test:handshake', new SimpleProvider())    

    return new Promise( (resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Provider as Class registered', () => {
    // this one is good as long as there's no errors yet
    expect(1).toBe(1)
});

test('Provider method notification turned on', () => {
    expect(providerMethodNotificationRegistered).toBe(true)
})

test('Provider method request dispatched', () => {
    expect(providerMethodRequestDispatched).toBe(true)
})

test('Provider called ready method', () => {
    expect(providerMethodReadySent).toBe(true)
})

test('Provide method called with two args (parameters, session)', () => {
    expect(numberOfArgs).toBe(2)
})

test('Provide method session arg DOES have focus', () => {
    expect(methodSession.hasOwnProperty('focus')).toBe(true)
})

test('Provider response used correct correlationId', () => {
    expect(responseCorrelationId).toBe(123)
})

test('Provider method result is correct', () => {
    expect(value).toBe('a value!')
})
