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
import { expect } from '@jest/globals';

test('Temporal Set - all known values', () => {
    return Advanced.list().then(items => {
        console.dir(items)
        expect(Array.isArray(items)).toBe(true)
    })
})

test('Temporal Set - first match', () => {
    return Advanced.list(10000).then(item => {
        console.dir(item)
        expect(Array.isArray(item)).toBe(false)
    })
})


test('Temporal Set - live list', () => {

    return new Promise( (resolve, reject) => {
        const process = Advanced.list((item) => {
            // add
            console.dir(item)
            expect(item.aString).toBe("Here's a string")
            expect(item.aNumber).toBe(123)
            expect(typeof item.aMethod).toBe('function')
            item.aMethod().then(result => {
                expect(result.foo).toBe("here's foo")
                expect(result.bar).toBe(1)
                resolve()
            })
        },
        (item) => {
            // remove
        })

        expect(typeof process.stop).toBe('function')
    })
})
