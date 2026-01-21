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
import { EventExtension } from '../../build/sdk/javascript/src/sdk.mjs'


import { expect } from '@jest/globals';

let contextSentToEvent = false
let bothContextSentToEvent = false

beforeAll(() => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        //assert that module is EventExtension
        expect(module).toBe('EventExtension')

        if (method === "onEventWithContext") {
            if (json.params.appId === 'some-app') {
                contextSentToEvent = true
            }
        }
        else if (method === "onEventWithTwoContextParams") {
            if (json.params.appId === 'some-app' && json.params.state === 'inactive') {
                bothContextSentToEvent = true
            }
        }
    });

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})


test('Event with single context param', () => {
    EventExtension.listen("onEventWithContext", "some-app", (data) => {
        expect(contextSentToEvent).toBe(true)
    })
})

test('Event with two context params', () => {
    EventExtension.listen("onEventWithTwoContextParams", "some-app", "inactive", (data) => {
        expect(bothContextSentToEvent).toBe(true)
    })
})