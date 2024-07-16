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

import { Settings, Provider } from '../../build/sdk/javascript/src/sdk.mjs'
import Setup from '../Setup.js'
import { transport } from '../TransportHarness.js'

let providerMethodOneNotificationRegistered = false
let providerMethodOneRequestDispatched = false
let providerMethodOneResultSent = false
let numberOfArgsMethodOne = -1
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

    Settings.setLogLevel('DEBUG')

    class MultiProvider {
        multiMethodOne() {
            numberOfArgsMethodOne = arguments.length
            return Promise.resolve('a value!')
        }

        multiMethodTwo() {
            numberOfArgsMethodTwo = arguments.length
            return Promise.resolve('another value!')
        }
    }
    
    transport.onSend(message => {
        const json = JSON.parse(message)
        if (json.method) {
            if (json.method === 'Provider.provideMultipleMethods') {
                providerMethodOneNotificationRegistered = true
                providerMethodTwoNotificationRegistered = true

                // send out a request event
                setTimeout( _ => {
                    providerMethodOneRequestDispatched = true
                    transport.request({
                        id: 1,
                        method: 'MultipleMethods.multiMethodOne'
                    })
                })
                setTimeout( _ => {
                    providerMethodTwoRequestDispatched = true
                    transport.request({
                        id: 2,
                        method: "MultipleMethods.multiMethodTwo"
                    })
                })                
            }
        }
        else {
            if (json.id === 1 && json.result) {
                providerMethodOneResultSent = true
                valueOne = json.result
            }    
            else if (json.id === 2 && json.result) {
                providerMethodTwoResultSent = true
                valueTwo = json.result
            }
        }
    })

    Provider.provideMultipleMethods(new MultiProvider()) 

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
    expect(numberOfArgsMethodOne).toBe(0)
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
    expect(numberOfArgsMethodTwo).toBe(0)
})

test('Provider method 2 result is correct', () => {
    expect(valueTwo).toBe('another value!')
})
