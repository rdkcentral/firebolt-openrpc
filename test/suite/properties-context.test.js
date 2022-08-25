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

import { Advanced } from '../../build/sdk/javascript/src/sdk.mjs'
import Setup from '../Setup'
import { transport } from '../TransportHarness.js'
import { expect } from '@jest/globals';

let propertySetterWasTriggered = false
let propertySetterWasTriggeredWithValue = false

beforeAll( () => {

    transport.onSend(json => {
        if (json.method === 'advanced.propertyWithContext') {
            transport.response(json.id, true)            
        }
        else if (json.method === 'advanced.onPropertyWithContextChanged') {
            // Confirm the listener is on
            transport.response(json.id, {
                listening: true,
                event: json.method
            })

            // send out a request event
            setTimeout( _ => {
                transport.response(json.id, false)
            })
        }
        else if (json.method === 'advanced.setPropertyWithContext') {
            propertySetterWasTriggered = true
            if (json.params.value === true) {
                propertySetterWasTriggeredWithValue = true
            }
        }
    })

    Advanced.propertyWithContext('hulu', true)

    return new Promise( (resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Context Property get', () => {
    return Advanced.propertyWithContext().then(result => {
        expect(result).toBe(true)
    })
});

test('Context Property subscribe', () => {
    return Advanced.propertyWithContext(value => {
        expect(value).toBe(false)
    })
});

test('Context Property set', () => {
    expect(propertySetterWasTriggered).toBe(true)
    expect(propertySetterWasTriggeredWithValue).toBe(true)
});
