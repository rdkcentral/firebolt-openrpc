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
class String {
    public:
        String()
            : _value()
        {
        }
        String(const std::string& value)
            : _value(value)
        {
        }
        String(const String& copy)
            : _value(copy._value)
        {
            
        }
        inline ~String() = default;
        String& operator=(const String& RHS)
        {
            _value = RHS._value;
            return (*this);
        }

    public:
        const std::string& Value() const
        {
            return _value;
        }

    private:
        std::string _value;
    };
}
