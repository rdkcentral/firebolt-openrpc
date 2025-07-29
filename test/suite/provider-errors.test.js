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

import { transport } from '../TransportHarness.js'
import MockTransport from '../../build/sdk/javascript/src/Transport/MockTransport.mjs'
import { Provider } from '../../build/sdk/javascript/src/sdk.mjs'
import { expect } from '@jest/globals';

let providerMethodRequestReceived = false
let providerMethodErrorSent = false
let errorData
let errorMessage
let errorCode

beforeAll(() => {
    transport.onSend((json) => {
        if (json.method) {
            let [module, method] = json.method.split('.')
            expect(module).toBe('Provider')

        }
        else {

            if (json.error) {
                providerMethodErrorSent = true
                errorMessage = json.error.message
                errorCode = json.error.code
                errorData = json.error.data
            }

        }
    })

    class SimpleProvider {
        requestSimpleMethod(...args) {
            providerMethodRequestReceived = true

            throw {
                message: 'An error occured!',
                code: 50,
                data: {
                    info: 'the_info'
                }
            }
        }
    };

    Provider.provide(new SimpleProvider())
    //call the provider method to trigger the error
    MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", method: "Provider.requestSimpleMethod", id: 1 }))

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Provider as Class registered', () => {
    // this one is good as long as there's no errors yet
    expect(1).toBe(1)
});

test('Provider method throw an exeption', () => {

    expect(providerMethodRequestReceived).toBe(true)
    expect(providerMethodErrorSent).toBe(true)
    expect(errorMessage).toBe('An error occured!')
    expect(errorCode).toBe(50)
    expect(errorData).toEqual({ info: 'the_info' })

})

