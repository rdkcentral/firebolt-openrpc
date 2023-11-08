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

let state = {
    spy: null,
    responder: null
}

class TransportSpy {

    constructor(spy) {
        state.spy = spy
    }

    async send(msg) {
        let parsed = JSON.parse(msg)
        console.log(state.spy)
        state.spy(parsed)
        this.responder(JSON.stringify({
            jsonrpc: '2.0',
            id: parsed.id,
            result: {}
        }))
    }

    receive(callback) {
        this.responder = callback
    }
}

test('Basic', () => {
    return Simple.method(true).then(result => {
        expect(result.foo).toBe("here's foo")
    })
});

test('Multiple Parameters', async () => {
    let cb = null;
    let promise = new Promise((resolve, reject) => {
        cb = resolve
    })
    window['__firebolt'].setTransportLayer(new TransportSpy(cb))
    await Simple.methodWithMultipleParams(5, 'foo')
    let msg = await promise
    expect(msg.method).toBe('simple.methodWithMultipleParams')
    expect(msg.params.id).toBe(5)
    expect(msg.params.title).toBe('foo')
    console.log(JSON.stringify(msg))
});
