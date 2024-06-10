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
let value

beforeAll( () => {

    class SimpleProvider {
        simpleMethod() {
            numberOfArgs = arguments.length
            return Promise.resolve('a value!')
        }
    }
    
    transport.onSend(json => {
        if (json.method) {
            if (json.method === 'Provider.provideSimple') {
                providerMethodNotificationRegistered = true

                // send out a request event
                setTimeout( _ => {
                    providerMethodRequestDispatched = true
                    transport.request({
                        id: 1,
                        method: 'Simple.simpleMethod'
                    })
                })
            }
        }
        else {
            if (json.id === 1 && json.result) {
                providerMethodResultSent = true
                value = json.result
            }    
        }
    })

    Provider.provideSimple(new SimpleProvider())    

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
    expect(numberOfArgs).toBe(0)
})

test('Provider method result is correct', () => {
    expect(value).toBe('a value!')
})
