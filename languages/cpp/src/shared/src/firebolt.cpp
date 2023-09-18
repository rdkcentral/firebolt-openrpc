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

#include "FireboltSDK.h"


#ifdef __cplusplus
extern "C" {
#endif


int32_t FireboltSDK_Initialize(char* configLine) {
    FireboltSDK::Accessor::Instance(configLine);
    return Firebolt_Error_None;
}

int32_t FireboltSDK_Deinitialize(void) {
    FireboltSDK::Accessor::Dispose();
    return Firebolt_Error_None;
}

#ifdef __cplusplus
}
#endif