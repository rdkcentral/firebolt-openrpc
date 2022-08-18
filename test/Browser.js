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

/*
 * This file polyfills various Browser APIs so that they work in nodejs
 * SDKs that leverage firebolt-openrpc should reference it via the
 * project's jest.config.json file via the setupFiles option, e.g.:
 * 
 * setupFiles: [
 *   "./node_modules/@firebolt-js/openrpc/test/Browser.js"
 * ]
 * 
 */

import fetch from 'node-fetch'
import { TextDecoder } from 'util'

if (!global.fetch && !window.fetch) {
    console.log('Using node-fetch package to polyfill window.fetch')
    global.fetch = fetch
}

if (!global.TextDecoder && !window.TextDecoder) {
    console.log('Using text-decoding package to polyfill window.TextDecoder')
    global.TextDecoder = TextDecoder
}
