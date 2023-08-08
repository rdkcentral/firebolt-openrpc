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

import { Simple } from '../../build/sdk/javascript/src/sdk.mjs'
import Setup from '../Setup'
import { transport } from '../TransportHarness.js'
import { expect } from '@jest/globals';

let propertySetterWasTriggered = false
let propertySetterWasTriggeredWithValue = false

beforeAll( () => {

    transport.onSend(json => {
        if (json.method === 'simple.property') {
            transport.response(json.id, {
                foo: "here's foo"
            })            
        }
        else if (json.method === 'simple.onPropertyChanged') {
            // Confirm the listener is on
            transport.response(json.id, {
                listening: true,
                event: json.method
            })

            // send out a request event
            setTimeout( _ => {
                transport.response(json.id, {
                    foo: "here's foo"
                })
            })
        }
        else if (json.method === 'simple.setProperty') {
            propertySetterWasTriggered = true
            if (json.params.value.foo === 'a new foo!' || json.params.value.foo === null) {
                propertySetterWasTriggeredWithValue = true
            }
        }
    })

    return new Promise( (resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Basic Property get', () => {
    return Simple.property().then(result => {
        expect(result.foo).toBe("here's foo")
    })
});

test('Basic Property subscribe', () => {
    return Simple.property(value => {
        expect(value.foo).toBe("here's foo")
    })
});

test('Basic Property set', () => {
    Simple.property({
        foo: 'a new foo!'
    })

    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});

test('Basic Property set with null', () => {
    Simple.property({
        foo: null
    })
    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});
