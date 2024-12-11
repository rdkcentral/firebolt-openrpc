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

#include "Gateway.h"

namespace FireboltSDK {

Gateway* Gateway::_instance = nullptr;

Gateway& Gateway::Instance()
{
    if (_instance == nullptr) {
        _instance = new Gateway(new GatewayImpl());
        ASSERT(_instance != nullptr);
    }
    return *_instance;
}

void Gateway::Dispose()
{
    ASSERT(_instance != nullptr);
    if (_instance != nullptr) {
        delete _instance;
        _instance = nullptr;
    }
}

Gateway::Gateway(GatewayImpl *implementation)
    : _implementation(implementation)
{
    _instance = this;
}

Gateway::~Gateway()
{
    delete _implementation;
}

void Gateway::Configure(Transport<WPEFramework::Core::JSON::IElement>* transport)
{
    _implementation->Configure(transport);
}

}

