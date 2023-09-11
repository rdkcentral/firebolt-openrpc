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

#ifndef FIREBOLT_ERROR_H
#define FIREBOLT_ERROR_H

#ifdef __cplusplus
extern "C" {
#endif

enum Firebolt_Error {
    Firebolt_Error_None = 0,
    Firebolt_Error_General = 1,
    Firebolt_Error_Timedout = 2,
    Firebolt_Error_Unavailable = 3,
    Firebolt_Error_InUse = 4,
    Firebolt_Error_NotSupported = 5,
    Firebolt_Error_InvalidRequest = -32600,
    Firebolt_Error_MethodNotFound = -32601,
    Firebolt_Error_InvalidParams = -32602,
    Firebolt_Error_CapabilityNotAvaialbale = -50300,
    Firebolt_Error_CapabilityNotSupported = -50100
    Firebolt_Error_CapabilityGet = -50200
    Firebolt_Error_CapabilityNotPermitted = - 40300
};

#ifdef __cplusplus
}
#endif

#endif // FIREBOLT_ERROR_H
