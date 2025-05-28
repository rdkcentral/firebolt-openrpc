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


function removeNullOptionalParams(params, numOfOptionalParams) {

// Iterate over all params starting backwrods and if the param is null remove it from the params object. 
// If it is undefined that means the param is not provided, which is Ok.
// We should not get a call with numOfOptionalParams === 0, but if we do, just return the params as are.
const keys = Object.keys(params)
let paramsIndex = keys.length - 1
while (paramsIndex >= 0 && numOfOptionalParams > 0) {
    const key = keys[paramsIndex]
    if (params[key] === null) {
    delete params[key]
    console.warn('WARNING: null values for optional params will be disallowed in a future Firebolt version. Parameter: ' + key)
    } else if (params[key] === undefined) {
    // undefined means the param is not provided, we should continue.
    } else {
    // if an optional param is provided we should stop removing params as if we continue we will change the order of the params
    break
    }
    paramsIndex--
    numOfOptionalParams--
}
return params
}

${if.bidirectional}
import Bidirectional from './Bidirectional.mjs';
Bidirectional.removeNullOptionalParams = removeNullOptionalParams;
// Export the Bidirectional class as the default export
export default Bidirectional;
${end.if.bidirectional}

${if.unidirectional}
import Unidirectional from './Unidirectional.mjs';
Unidirectional.removeNullOptionalParams = removeNullOptionalParams;
// Export the Unidirectional class as the default export
export default Unidirectional;
${end.if.unidirectional}