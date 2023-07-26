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

#include "Module.h"
#include "types.h"
#include "TypesPriv.h"

#ifdef __cplusplus
extern "C" {
#endif

// String Type Handler Interfaces
const char* Firebolt_String(Firebolt_String_t handle)
{
    return ((reinterpret_cast<FireboltSDK::JSON::String*>(handle))->Value().c_str());
}

void Firebolt_String_Release(Firebolt_String_t handle)
{
    delete reinterpret_cast<FireboltSDK::JSON::String*>(handle);
}

#ifdef __cplusplus
}
#endif
