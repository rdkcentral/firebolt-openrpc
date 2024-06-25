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

import { Simple, Advanced, Settings } from '../../build/sdk/javascript/src/sdk.mjs'
import Setup from '../Setup'
import { expect } from '@jest/globals';

Settings.setLogLevel('DEBUG')

test('Method as attribute', () => {
    return Simple.methodWithMethodAttribute('test').then( result => {
        expect(typeof result.aMethod).toBe('function')
    })
});

test('Method attribute returns promise', () => {
    return Simple.methodWithMethodAttribute('test').then( result => {
        expect(result.aMethod() instanceof Promise).toBe(true)
    })
});

test('Method attribute promise resolves', () => {
    return Simple.methodWithMethodAttribute('test').then( async result => {
        const value = await result.aMethod()
        expect(value).toBeDefined()
    })
})
