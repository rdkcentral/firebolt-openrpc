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

#ifdef UNIT_TEST

#include "TypesPriv.h"

namespace Firebolt
{
    namespace Authentication
    {
        class JsonData_Token;
    }
}

class IGateway
{
public:
    virtual ~IGateway() = default;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, FireboltSDK::JSON::String &result) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Authentication::JsonData_Token &result) = 0;
};
#endif
