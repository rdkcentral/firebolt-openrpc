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


beforeAll(() => {

    transport.onSend = (module, method, json_params, json_id) => {
        expect(module).toBe('Simple')

        if (method === 'method') {
            //setTimeout( _ => {
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { foo: "here's foo", value: 5 }, id: json_id }))
            //})     
        }
        else if (method === 'methodWithMultipleParams') {

            //setTimeout( _ => {
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: true, id: json_id }))
            //}) 

        }
    }

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Basic', () => {
    return Simple.method(true).then(result => {
        expect(result.foo).toBe("here's foo")
    })
});

test('Multiple Parameters', async () => {
    return Simple.methodWithMultipleParams(5, 'foo').then(result => {
        expect(result).toBe(true)
    })

});
