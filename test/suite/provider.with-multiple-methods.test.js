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

let providerMethodOneNotificationRegistered = false
let providerMethodOneRequestDispatched = false
let providerMethodOneResultSent = false
let numberOfArgsMethodOne = -1
let methodOneParameters
let methodOneSession
let valueOne
let responseCorrelationIdOne

let providerMethodTwoNotificationRegistered = false
let providerMethodTwoRequestDispatched = false
let providerMethodTwoResultSent = false
let numberOfArgsMethodTwo = -1
let methodTwoParameters
let methodTwoSession
let valueTwo
let responseCorrelationIdTwo


beforeAll( () => {

    class MultiProvider {
        multiMethodOne(...args) {
            numberOfArgsMethodOne = args.length
            methodOneParameters = args[0]
            methodOneSession = args[1]
            return Promise.resolve('a value!')
        }

        multiMethodTwo(...args) {
            numberOfArgsMethodTwo = args.length
            methodTwoParameters = args[0]
            methodTwoSession = args[1]
            return Promise.resolve('another value!')
        }
    }
    
    transport.onSend(json => {
        if (json.method === 'provider.onRequestMultiMethodOne') {
            providerMethodOneNotificationRegistered = true

            // Confirm the listener is on
            transport.response(json.id, {
                listening: true,
                event: json.method
            })

            // send out a request event
            setTimeout( _ => {
                providerMethodOneRequestDispatched = true
                transport.response(json.id, {
                    correlationId: 123
                })
            })
        }
        else if (json.method === 'provider.multiMethodOneResponse') {
            providerMethodOneResultSent = true
            valueOne = json.params.result
            responseCorrelationIdOne = json.params.correlationId
        }
        if (json.method === 'provider.onRequestMultiMethodTwo') {
            providerMethodTwoNotificationRegistered = true

            // Confirm the listener is on
            transport.response(json.id, {
                listening: true,
                event: json.method
            })

            // send out a request event
            setTimeout( _ => {
                providerMethodTwoRequestDispatched = true
                transport.response(json.id, {
                    correlationId: 456
                })
            })
        }
        else if (json.method === 'provider.multiMethodTwoResponse') {
            providerMethodTwoResultSent = true
            valueTwo = json.params.result
            responseCorrelationIdTwo = json.params.correlationId
        }
    })

    Provider.provide('xrn:firebolt:capability:test:multi', new MultiProvider())    

    return new Promise( (resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Provider as Class registered', () => {
    // this one is good as long as there's no errors yet
    expect(1).toBe(1)
});

test('Provider method 1 notification turned on', () => {
    expect(providerMethodOneNotificationRegistered).toBe(true)
})

test('Provider method 1 request dispatched', () => {
    expect(providerMethodOneRequestDispatched).toBe(true)
})

test('Provide method 1 called with two args', () => {
    expect(numberOfArgsMethodOne).toBe(2)
})

test('Provide method 1 parameters arg is null', () => {
    expect(methodOneParameters).toBe(null)
})

test('Provide method 1 session arg has correlationId', () => {
    expect(methodOneSession.correlationId()).toBe(123)
})

test('Provide method 1 session arg DOES NOT have focus', () => {
    expect(methodOneSession.hasOwnProperty('focus')).toBe(false)
})

test('Provider response 1 used correct correlationId', () => {
    expect(responseCorrelationIdOne).toBe(123)
})

test('Provider method 1 result is correct', () => {
    expect(valueOne).toBe('a value!')
})

test('Provider method 2 notification turned on', () => {
    expect(providerMethodTwoNotificationRegistered).toBe(true)
})

test('Provider method 2 request dispatched', () => {
    expect(providerMethodTwoRequestDispatched).toBe(true)
})

test('Provide method 2 called with two args', () => {
    expect(numberOfArgsMethodTwo).toBe(2)
})

test('Provide method 2 parameters arg is null', () => {
    expect(methodTwoParameters).toBe(null)
})

test('Provide method 2 session arg has correlationId', () => {
    expect(methodTwoSession.correlationId()).toBe(456)
})

test('Provide method 2 session arg DOES NOT have focus', () => {
    expect(methodTwoSession.hasOwnProperty('focus')).toBe(false)
})

test('Provider response 2 used correct correlationId', () => {
    expect(responseCorrelationIdTwo).toBe(456)
})

test('Provider method 2 result is correct', () => {
    expect(valueTwo).toBe('another value!')
})
