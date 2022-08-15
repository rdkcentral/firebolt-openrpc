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

const config = (await import(process.env.npm_package_json)).default

const nodeVersion = () => {
    const nodeVersionString = (config.devDependencies || {}).node || ""
    let nodeVersionMajor = nodeVersionString.match(/^[~^@]?([0-9]+)/)
    if (nodeVersionMajor && nodeVersionMajor.length) {
        return nodeVersionMajor[1]
    }
    else {
        return 0
    }
}

// add fetch polyfill to node prior to 18
if (nodeVersion() < 18) {
    const fetch = await import('node-fetch')
    global.fetch  = fetch
}

global.window = {}
global.window.location = {
    set href(ref) {
        console.log(`window.location.href set to '${ref}'.`)
    }
}

global.window.__firebolt = {
    registerExtensionSDK: (id, initializer) => {
        initializer({
//            apiBaseUri: 'http://localhost:8080'
        }, {
            token: () => {
                return Promise.resolve("MOCK Token from Browser.js")
            }
        })
    }
}