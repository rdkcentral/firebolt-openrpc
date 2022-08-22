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
import Setup from '../Setup.js'
import { transport } from '../TransportHarness.js'

let providerMethodNotificationRegistered = false
let providerMethodRequestDispatched = false
let providerMethodResultSent = false
let numberOfArgs = -1
let methodParameters
let methodSession
let value
let responseCorrelationId


beforeAll( () => {

    class SimpleProvider {
        simpleMethod(...args) {
            methodParameters = args[0]
            methodSession = args[1]
            numberOfArgs = args.length
            return Promise.resolve('a value!')
        }
    }
    
    transport.onSend(json => {
        if (json.method === 'provider.onRequestSimpleMethod') {
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
        else if (json.method === 'provider.simpleMethodResponse') {
            providerMethodResultSent = true
            value = json.params.result
            responseCorrelationId = json.params.correlationId
        }
    })

    Provider.provide('xrn:firebolt:capability:test:simple', new SimpleProvider())    

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

test('Provide method called with two args', () => {
    expect(numberOfArgs).toBe(2)
})

test('Provide method parameters arg is null', () => {
    expect(methodParameters).toBe(null)
})

test('Provide method session arg has correlationId', () => {
    expect(methodSession.correlationId()).toBe(123)
})

test('Provide method session arg DOES NOT have focus', () => {
    expect(methodSession.hasOwnProperty('focus')).toBe(false)
})

test('Provider response used correct correlationId', () => {
    expect(responseCorrelationId).toBe(123)
})

test('Provider method result is correct', () => {
    expect(value).toBe('a value!')
})
