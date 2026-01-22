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
import { transport } from '../../TransportHarness.js';
import MockTransport from '../../../build/sdk/javascript/src/Transport/MockTransport.mjs';
import { Provider } from '../../../build/sdk/javascript/src/sdk.mjs';
let providerRegistered = false;
let numberOfArgsMethodOne = -1;
let methodOneParameters;
let valueOne;
let numberOfArgsMethodTwo = -1;
let methodTwoParam1;
let methodTwoParam2;
let valueTwo;
beforeAll(() => {
    class MultiProvider {
        requestMultiMethodOne(...args) {
            numberOfArgsMethodOne = args.length;
            methodOneParameters = args[0];
            return Promise.resolve(true);
        }
        requestMultiMethodTwo(...args) {
            numberOfArgsMethodTwo = args.length;
            methodTwoParam1 = args[0];
            methodTwoParam2 = args[1];
            return Promise.resolve('another value!');
        }
    }
    transport.onSend((json) => {
        if (json.method) {
            let [module, method] = json.method.split('.');
            expect(module).toBe('Provider');
            providerRegistered = true;
        }
        //catch the response
        if (json.method == null) {
            if (json.result) {
                if (json.id == 1) {
                    valueOne = json.result;
                }
                else if (json.id == 2) {
                    valueTwo = json.result;
                }
            }
        }
    });
    Provider.provide(new MultiProvider());
    MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", method: "Provider.requestMultiMethodOne", params: { "param1": true }, id: 1 }));
    MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", method: "Provider.requestMultiMethodTwo", params: { "param1": false, "param2": 123 }, id: 2 }));
    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100);
    });
});
test('Provider as Class registered', () => {
    // this one is good as long as there's no errors yet
    expect(1).toBe(1);
});
test('Provider registered', () => {
    expect(providerRegistered).toBe(true);
});
test('Provide method 1 called with two args', () => {
    expect(numberOfArgsMethodOne).toBe(1);
});
test('Provide method 1 param1 is true', () => {
    expect(methodOneParameters).toBe(true);
});
test('Provider method 1 result is correct', () => {
    expect(valueOne).toBe(true);
});
test('Provide method 2 called with two args', () => {
    expect(numberOfArgsMethodTwo).toBe(2);
});
test('Provide method 2 param1 arg is false', () => {
    expect(methodTwoParam1).toBe(false);
});
test('Provide method 2 param2 arg is false', () => {
    expect(methodTwoParam2).toBe(123);
});
test('Provider method 2 result is correct', () => {
    expect(valueTwo).toBe('another value!');
});
