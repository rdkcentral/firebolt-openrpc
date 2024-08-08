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

#pragma once

#include <string>

namespace FireboltSDK {
namespace JSON {
class String : public WPEFramework::Core::JSON::String {
    using Base = WPEFramework::Core::JSON::String;
    public:
        String()
            : Base()
            , _value()
        {
        }
        String(const char value[])
            : Base(value)
            , _value(value)
        {
        }
        String& operator=(const char RHS[])
        {
            Base::operator = (RHS);
            _value = RHS;
            return (*this);
        }
        String& operator=(const string RHS)
        {
            Base::operator = (RHS);
            _value = RHS;
            return (*this);
        }

    public:
        const string& Value() const
        {
            _value = Base::Value();
            return _value;
        }

    private:
        mutable std::string _value;
    };
}
}
