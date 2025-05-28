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

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')

        if (method === 'method') {
            //setTimeout( _ => {
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: { foo: "here's foo", value: 5 }, id: json.id }))
            //})     
        }
        else if (method === 'methodWithMultipleParams') {

            //setTimeout( _ => {
            MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: true, id: json.id }))
            //}) 

        }
    })

    return new Promise((resolve, reject) => {
        setTimeout(resolve, 100)
    })
})

test('Basic', () => {
    return Simple.method(true).then(result => {
        expect(result.foo).toBe("here's foo")
    })
});

test('Calls method with required parameter and validates payload', async () => {
    return Simple.methodWithMultipleParams(5, 'foo').then(result => {
        expect(result).toBe(true)
    })

});

test('Handles method call with no optional parameter provided', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneOptionalParam')
        expect(Object.keys(json.params).length).toBe(0)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneOptionalParam()
});


test('Handles method call with optional parameter provided', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneOptionalParam')
        expect(json.params.param1).toBe('foo')
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneOptionalParam('foo')
});

test('Handles method call with optional parameter explicitly set to null', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneOptionalParam')
        expect(Object.keys(json.params).length).toBe(0)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneOptionalParam(null)
});

test('Handles method with one required parameter, optional parameter omitted', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneRequiredOneOptionalParam')
        expect(Object.keys(json.params).length).toBe(1)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneRequiredOneOptionalParam("foo")
});

test('Handles method with one required parameter, optional parameter set to null', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneRequiredOneOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(Object.keys(json.params).length).toBe(1)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneRequiredOneOptionalParam('foo', null)
});

test('Handles method with both required and optional parameters set to null', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneRequiredOneOptionalParam')
        expect(json.params.param1).toBe(null)
        expect(Object.keys(json.params).length).toBe(1)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneRequiredOneOptionalParam(null, null)
});

test('Handles method call with both required and optional parameters provided', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithOneRequiredOneOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(json.params.param2).toBe('bar')
        expect(Object.keys(json.params).length).toBe(2)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithOneRequiredOneOptionalParam('foo', 'bar')
});

test('Handles method with two optional parameters: only required provided', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithTwoOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(Object.keys(json.params).length).toBe(1)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithTwoOptionalParam("foo")
});

test('Handles method with two optional parameters: first optional param set to null', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithTwoOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(Object.keys(json.params).length).toBe(1)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithTwoOptionalParam('foo', null)
});

test('Handles method with two optional parameters: both set to null', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithTwoOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(Object.keys(json.params).length).toBe(1)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithTwoOptionalParam('foo', null, null)
});

test('Handles method with two optional parameters: first provided, second not', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithTwoOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(json.params.param2).toBe('bar')
        expect(Object.keys(json.params).length).toBe(2)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithTwoOptionalParam('foo', 'bar')
});

test('Handles method with two optional parameters: first param set to null, second provided', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithTwoOptionalParam')
        expect(json.params.param1).toBe('foo')
        expect(json.params.param2).toBe(null)
        expect(json.params.param3).toBe('bar')
        expect(Object.keys(json.params).length).toBe(3)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithTwoOptionalParam('foo', null, "bar")
});

test('Handles optional parameters in wrong order', async () => {

    transport.onSend((json) => {
        let [module, method] = json.method.split('.')

        expect(module).toBe('Simple')
        expect(method).toBe('methodWithTwoOptionalParamInWrongOrder')
        expect(json.params.param1).toBe(null)
        expect(json.params.param2).toBe('foo')
        expect(json.params.param3).toBe('bar')
        expect(Object.keys(json.params).length).toBe(3)
        MockTransport.receiveMessage(JSON.stringify({ jsonrpc: "2.0", result: {}, id: json.id }))
    })
    Simple.methodWithTwoOptionalParamInWrongOrder(null, 'foo', "bar")
});
