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
import { Simple } from '../../build/sdk/javascript/src/sdk.mjs'
import { expect } from '@jest/globals';


let propertySetterWasTriggered = false
let propertySetterWasTriggeredWithValue = false

beforeAll(() => {

    transport.onSend = (module, method, json_params, json_id) => {

        expect(module).toBe('Simple')

        if (method === 'plainProperty') {
            /*
            transport.response(json_id, {
                foo: "here's foo"
            })
            */
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { foo: "here's foo" }, id: json_id }))
        }
        else if (method === 'onPlainPropertyChanged') {
            // Confirm the listener is on
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { listening: true, event: method }, id: json_id }))

        }
        else if (method === 'setPlainProperty') {
            propertySetterWasTriggered = true
            if (json_params.value.foo === 'a new foo!' || json_params.value.foo === null) {
                propertySetterWasTriggeredWithValue = true
            }
        }
    }

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})


test('Basic Property get', () => {
    return Simple.plainProperty().then(result => {
        expect(result.foo).toBe("here's foo")
    })
});

test('Basic Property subscribe', () => {
    return Simple.plainProperty(value => {
        expect(value.foo).toBe("here's foo")
    })
});

test('Basic Property set', () => {
    Simple.plainProperty({
        foo: 'a new foo!'
    })

    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});

test('Basic Property set with null', () => {
    Simple.plainProperty({
        foo: null
    })
    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});

//test listen to "plainPropertyChanged" event
test('Basic Property subscribe to event', () => {
    return Simple.listen("plainPropertyChanged", value => {
        expect(value.foo).toBe("here's foo")
    })
});