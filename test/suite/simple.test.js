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
import { expect } from '@jest/globals';


class TransportSpy {

    constructor(spy) {
        this.spy = spy
        this.responder = null
    }

    async send(msg) {
        let parsed = JSON.parse(msg)
        this.spy(parsed)
        let rzlt = {};

        if (parsed.method === 'simple.method') {
            rzlt = { foo: "here's foo" }
        }

        this.responder(JSON.stringify({
            jsonrpc: '2.0',
            id: parsed.id,
            result: rzlt
        }))
    }

    receive(callback) {
        this.responder = callback
    }
}

var promise = null

beforeEach(() => {
    let cb = null;
    promise = new Promise((resolve, reject) => {
        cb = resolve
    })
    window['__firebolt'].setTransportLayer(new TransportSpy(cb))
});

test('Basic', () => {
    return Simple.method(true).then(result => {
        expect(result.foo).toBe("here's foo")
    })
});
test('Calls method with required parameter and validates payload', async () => {

    await Simple.methodWithMultipleParams(5, 'foo')
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithMultipleParams')
    expect(msg.params.id).toBe(5)
    expect(msg.params.title).toBe('foo')
    console.log(JSON.stringify(msg))
});

test('Handles method call with no optional parameter provided', async () => {

    await Simple.methodWithOneOptionalParam()
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneOptionalParam')
    expect(Object.keys(msg.params).length).toBe(0)
});

test('Handles method call with optional parameter provided', async () => {

    await Simple.methodWithOneOptionalParam('foo')
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneOptionalParam')
    expect(msg.params.param1).toBe('foo')
});

test('Handles method call with optional parameter explicitly set to null', async () => {

    await Simple.methodWithOneOptionalParam(null)
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneOptionalParam')
    expect(Object.keys(msg.params).length).toBe(0)
});

test('Handles method with one required parameter, optional parameter omitted', async () => {

    await Simple.methodWithOneRequiredOneOptionalParam("foo")
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneRequiredOneOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(Object.keys(msg.params).length).toBe(1)
});

test('Handles method with one required parameter, optional parameter set to null', async () => {

    await Simple.methodWithOneRequiredOneOptionalParam('foo', null)
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneRequiredOneOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(Object.keys(msg.params).length).toBe(1)
});

test('Handles method with both required and optional parameters set to null', async () => {

    await Simple.methodWithOneRequiredOneOptionalParam(null, null)
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneRequiredOneOptionalParam')
    expect(msg.params.param1).toBe(null)
    expect(Object.keys(msg.params).length).toBe(1)
});

test('Handles method call with both required and optional parameters provided', async () => {

    await Simple.methodWithOneRequiredOneOptionalParam('foo', 'bar')
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithOneRequiredOneOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(msg.params.param2).toBe('bar')
    expect(Object.keys(msg.params).length).toBe(2)
});

test('Handles method with two optional parameters: only required provided', async () => {

    await Simple.methodWithTwoOptionalParam("foo")
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithTwoOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(Object.keys(msg.params).length).toBe(1)
});

test('Handles method with two optional parameters: first optional param set to null', async () => {

    await Simple.methodWithTwoOptionalParam('foo', null)
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithTwoOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(Object.keys(msg.params).length).toBe(1)
});

test('Handles method with two optional parameters: both set to null', async () => {

    await Simple.methodWithTwoOptionalParam('foo', null, null)
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithTwoOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(Object.keys(msg.params).length).toBe(1)
});

test('Handles method with two optional parameters: first provided, second not', async () => {

    await Simple.methodWithTwoOptionalParam('foo', 'bar')
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithTwoOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(msg.params.param2).toBe('bar')
    expect(Object.keys(msg.params).length).toBe(2)
});

test('Handles method with two optional parameters: first param set to null, second provided', async () => {

    await Simple.methodWithTwoOptionalParam('foo', null, "bar")
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithTwoOptionalParam')
    expect(msg.params.param1).toBe('foo')
    expect(msg.params.param2).toBe(null)
    expect(msg.params.param3).toBe('bar')
    expect(Object.keys(msg.params).length).toBe(3)
});

test('Handles optional parameters in wrong order', async () => {

    await Simple.methodWithTwoOptionalParamInWrongOrder(null, 'foo', "bar")
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithTwoOptionalParamInWrongOrder')
    expect(msg.params.param1).toBe(null)
    expect(msg.params.param2).toBe('foo')
    expect(msg.params.param3).toBe('bar')
    expect(Object.keys(msg.params).length).toBe(3)
});
