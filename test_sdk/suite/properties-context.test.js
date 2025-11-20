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
import { Advanced } from '../../build/sdk/javascript/src/sdk.mjs'


import { expect } from '@jest/globals';

let propertySetterWasTriggered = false
let propertySetterWasTriggeredWithValue = false
let contextSentToGetter = false
let contextSentToSetter = false
let contextSentToSubscriber = false
let contextSentToEvent = false
let bothContextSentToEvent = false

beforeAll(() => {

    transport.onSend ((json) => {
        let [module, method] = json.method.split('.')

        //assert that module is Advanced
        expect(module).toBe('Advanced')

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
        else if (method === "onEventWithContext") {
            if (json.params.appId === 'some-app') {
                contextSentToEvent = true
            }
        }
        else if (method === "onEventWithTwoContext") {
            if (json.params.appId === 'some-app' && json.params.state === 'inactive') {
                bothContextSentToEvent = true
            }
        }
    });

    Advanced.propertyWithContext('some-app', true)

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Context Property get', () => {
    return Advanced.propertyWithContext("some-app").then(result => {
        expect(result).toBe(true)
        expect(contextSentToGetter).toBe(true)
    })
});

test('Context Property subscribe', () => {
    return Advanced.propertyWithContext("some-app", value => {
        expect(value).toBe(false)
        expect(contextSentToSubscriber).toBe(true)
    })
});

test('Context Property set', () => {
    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
    expect(contextSentToSetter).toBe(true)
});

test('Event with single context param', () => {
    Advanced.listen("onEventWithContext", "some-app", (data) => {
        expect(contextSentToEvent).toBe(true)
    })
})

test('Event with two context params', () => {
    Advanced.listen("onEventWithTwoContext", "some-app", "inactive", (data) => {
        expect(bothContextSentToEvent).toBe(true)
    })
})