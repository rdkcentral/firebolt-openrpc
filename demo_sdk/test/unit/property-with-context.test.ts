/*
 * Copyright 2026 Comcast Cable Communications Management, LLC
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

import { test, expect, beforeAll } from '@jest/globals';

import { transport } from '../../TransportHarness.js'
import MockTransport from '../../../build/sdk/javascript/src/Transport/MockTransport.mjs'
import { PropertyExtension } from '../../../build/sdk/javascript/src/sdk.mjs'

let propertySetterWasTriggered = false
let propertySetterWasTriggeredWithValue = false
let contextSentToGetter = false
let contextSentToSetter = false
let contextSentToSubscriber = false

beforeAll(() => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        //assert that module is PropertyExtension
        expect(module).toBe('PropertyExtension')

        if (method === 'propertyWithContext') {
            if (json.params.appId === 'some-app') {
                contextSentToGetter = true
            }
            //transport.response(json.id, true) 
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: true, id: json.id }))
        }
        else if (method === 'onPropertyWithContextChanged') {
            if (json.params.appId === 'some-app') {
                contextSentToSubscriber = true
            }

            // Confirm the listener is on
            /* transport.response(json.id, {
                 listening: true,
                 event: method
             })
                 */
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { listening: true, event: method }, id: json.id }))

            // send out a request event
            setTimeout(_ => {
                transport.response(json.id, false)
            })
        }
        else if (method === 'setPropertyWithContext') {
            if (json.params.appId === 'some-app') {
                contextSentToSetter = true
            }

            propertySetterWasTriggered = true
            if (json.params.value === true) {
                propertySetterWasTriggeredWithValue = true
            }
        }
    });

    PropertyExtension.propertyWithContext('some-app', true)

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Context Property get', () => {
    return PropertyExtension.propertyWithContext("some-app").then(result => {
        expect(result).toBe(true)
        expect(contextSentToGetter).toBe(true)
    })
});

test('Context Property subscribe', () => {
    return PropertyExtension.propertyWithContext("some-app", value => {
        expect(value).toBe(false)
        expect(contextSentToSubscriber).toBe(true)
    })
});

test('Context Property set', () => {
    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
    expect(contextSentToSetter).toBe(true)
});