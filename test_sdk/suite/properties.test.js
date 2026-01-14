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

    transport.onSend ((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')

        if (method === 'plainProperty') {
            /*
            transport.response(json.id, {
                foo: "here's foo"
            })
            */
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { foo: "here's foo" }, id: json.id }))
        }
        else if (method === 'onPlainPropertyChanged') {
            // Confirm the listener is on
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { listening: true, event: method }, id: json.id }))

        }
        else if (method === 'setPlainProperty') {
            propertySetterWasTriggered = true
            if (json.params.value.foo === 'a new foo!' || json.params.value.foo === null) {
                propertySetterWasTriggeredWithValue = true
            }
        }
    })

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
    let p = Simple.plainProperty(value => {
        expect(value).toBe("value 123")
        Simple.clear();
    })
    MockTransport.event("Simple","onPlainPropertyChanged",  "value 123");
    return p;
});

// This is to test the patch in bidirectional gateway to handle events differently if params in the jsonrpc message is an array
test('Test event payload and array should be handled as a single argument array', () => {
    let p = Simple.plainProperty(value => {
        expect(Array.isArray(value)).toBe(true)
        Simple.clear();
    })
    MockTransport.event("Simple","onPlainPropertyChanged",  [1,2,3]);
    return p;
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

//test listen to "onPlainPropertyChanged" event
test('Basic Property subscribe to event', () => {
    Simple.clear("onPlainPropertyChanged");
    let p = Simple.listen("onPlainPropertyChanged", value => {
        expect(value).toBe( "value 123")
    })
    MockTransport.event("Simple","onPlainPropertyChanged",  "value 123");
    return p;
});