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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { test, expect, beforeAll } from '@jest/globals';
import { transport } from '../../TransportHarness.js';
import MockTransport from '../../../build/sdk/javascript/src/Transport/MockTransport.mjs';
import { Simple } from '../../../build/sdk/javascript/src/sdk.mjs';
beforeAll(() => {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        if (method === 'method') {
            //setTimeout( _ => {
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { foo: "here's foo", value: 5 }, id: json.id }));
            //})     
        }
        else if (method === 'testMultipleRequiredParams') {
            //setTimeout( _ => {
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: true, id: json.id }));
            //}) 
        }
    });
    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100);
    });
});
test('Basic', () => {
    return Simple.testBasicMethod(true).then(result => {
        expect(result.foo).toBe("here's foo");
    });
});
test('Calls method with required parameter and validates payload', () => __awaiter(void 0, void 0, void 0, function* () {
    return Simple.testMultipleRequiredParams(5, 'foo').then(result => {
        expect(result).toBe(true);
    });
}));
test('Handles method call with no optional parameter provided', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testSingleOptionalParam');
        expect(Object.keys(json.params).length).toBe(0);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testSingleOptionalParam();
}));
test('Handles method call with optional parameter provided', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testSingleOptionalParam');
        expect(json.params.param1).toBe('foo');
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testSingleOptionalParam('foo');
}));
test('Handles method call with optional parameter explicitly set to null', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testSingleOptionalParam');
        expect(Object.keys(json.params).length).toBe(0);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testSingleOptionalParam(null);
}));
test('Handles method with one required parameter, optional parameter omitted', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMixedOptionalityParams');
        expect(Object.keys(json.params).length).toBe(1);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMixedOptionalityParams("foo");
}));
test('Handles method with one required parameter, optional parameter set to null', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMixedOptionalityParams');
        expect(json.params.param1).toBe('foo');
        expect(Object.keys(json.params).length).toBe(1);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMixedOptionalityParams('foo', null);
}));
test('Handles method with both required and optional parameters set to null', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMixedOptionalityParams');
        expect(json.params.param1).toBe(null);
        expect(Object.keys(json.params).length).toBe(1);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMixedOptionalityParams(null, null);
}));
test('Handles method call with both required and optional parameters provided', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMixedOptionalityParams');
        expect(json.params.param1).toBe('foo');
        expect(json.params.param2).toBe('bar');
        expect(Object.keys(json.params).length).toBe(2);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMixedOptionalityParams('foo', 'bar');
}));
test('Handles method with two optional parameters: only required provided', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMultipleOptionalParams');
        expect(json.params.param1).toBe('foo');
        expect(Object.keys(json.params).length).toBe(1);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMultipleOptionalParams("foo");
}));
test('Handles method with two optional parameters: first optional param set to null', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMultipleOptionalParams');
        expect(json.params.param1).toBe('foo');
        expect(Object.keys(json.params).length).toBe(1);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMultipleOptionalParams('foo', null);
}));
test('Handles method with two optional parameters: both set to null', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMultipleOptionalParams');
        expect(json.params.param1).toBe('foo');
        expect(Object.keys(json.params).length).toBe(1);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMultipleOptionalParams('foo', null, null);
}));
test('Handles method with two optional parameters: first provided, second not', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMultipleOptionalParams');
        expect(json.params.param1).toBe('foo');
        expect(json.params.param2).toBe('bar');
        expect(Object.keys(json.params).length).toBe(2);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMultipleOptionalParams('foo', 'bar');
}));
test('Handles method with two optional parameters: first param set to null, second provided', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMultipleOptionalParams');
        expect(json.params.param1).toBe('foo');
        expect(json.params.param2).toBe(null);
        expect(json.params.param3).toBe('bar');
        expect(Object.keys(json.params).length).toBe(3);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMultipleOptionalParams('foo', null, "bar");
}));
test('Handles optional parameters in wrong order', () => __awaiter(void 0, void 0, void 0, function* () {
    transport.onSend((json) => {
        let [module, method] = json.method.split('.');
        expect(module).toBe('Simple');
        expect(method).toBe('testMultipleOptionalParamsInWrongOrder');
        expect(json.params.param1).toBe(null);
        expect(json.params.param2).toBe('foo');
        expect(json.params.param3).toBe('bar');
        expect(Object.keys(json.params).length).toBe(3);
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }));
    });
    Simple.testMultipleOptionalParamsInWrongOrder(null, 'foo', "bar");
}));
