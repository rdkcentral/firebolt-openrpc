/*
 * Copyright 2023 Comcast Cable Communications Management, LLC
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

#ifndef _FIREBOLT_ERROR_H
#define _FIREBOLT_ERROR_H

#ifdef __cplusplus
extern "C" {
#endif

typedef enum FireboltSDKError {
    FireboltSDKErrorNone = 0,
    FireboltSDKErrorGeneral = 1,
    FireboltSDKErrorUnavailable = 2,
    FireboltSDKErrorTimedout = 3,
    FireboltSDKErrorNotSubscribed = 4,
    FireboltSDKErrorUnknown = 5,
    FireboltSDKErrorInUse = 6,
    FireboltSDKErrorNotSupported = 7
} FireboltSDKError_t;

#ifdef __cplusplus
}
#endif

#endif // _FIREBOLT_ERROR_H
