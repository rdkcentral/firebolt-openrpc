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

import { transport } from '../TransportHarness.js'
import MockTransport from '../../build/sdk/javascript/src/Transport/MockTransport.mjs'
import { PropertyExtension } from '../../build/sdk/javascript/src/sdk.mjs'
import { expect } from '@jest/globals';

let propertySetterWasTriggered = false
let propertySetterWasTriggeredWithValue = false

beforeAll(() => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('PropertyExtension')

        if (method === 'basicProperty') {
            /*
            transport.response(json.id, {
                foo: "here's foo"
            })
            */
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { foo: "here's foo" }, id: json.id }))
        }
        else if (method === 'onBasicPropertyChanged') {
            // Confirm the listener is on
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { listening: true, event: method }, id: json.id }))

        }
        else if (method === 'setBasicProperty') {
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
    return PropertyExtension.basicProperty().then(result => {
        expect(result.foo).toBe("here's foo")
    })
});

test('Basic Property subscribe', () => {
    let p = PropertyExtension.basicProperty(value => {
        expect(value).toBe("value 123")
        PropertyExtension.clear();
    })
    MockTransport.event("PropertyExtension", "onbasicPropertyChanged", "value 123");
    return p;
});

// This is to test the patch in Bidirectional gateway that handles event payloads that are arrays
test('Test event payload and array should be handled as a single argument array', () => {
    let p = PropertyExtension.basicProperty(value => {
        expect(Array.isArray(value)).toBe(true)
        PropertyExtension.clear();
    })
    MockTransport.event("PropertyExtension", "onbasicPropertyChanged", [1, 2, 3]);
    return p;
});

test('Basic Property set', () => {
    PropertyExtension.basicProperty({
        foo: 'a new foo!'
    })

    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});

test('Basic Property set with null', () => {
    PropertyExtension.basicProperty({
        foo: null
    })
    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});

//test listen to "onbasicPropertyChanged" event
test('Basic Property subscribe to event', () => {
    PropertyExtension.clear("onbasicPropertyChanged");
    let p = PropertyExtension.listen("onbasicPropertyChanged", value => {
        expect(value).toBe("value 123")
    })
    MockTransport.event("PropertyExtension", "onbasicPropertyChanged", "value 123");
    return p;
});