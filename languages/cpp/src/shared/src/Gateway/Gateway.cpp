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

Gateway* Gateway::instance = nullptr;

Gateway& Gateway::Instance()
{
    if (instance == nullptr) {
        instance = new Gateway(std::make_unique<GatewayImpl>());
        ASSERT(instance != nullptr);
    }
    return *instance;
}

void Gateway::Dispose()
{
    ASSERT(instance != nullptr);
    if (instance != nullptr) {
        delete instance;
        instance = nullptr;
    }
}

Gateway::Gateway(std::unique_ptr<GatewayImpl> implementation)
    : implementation(implementation.release())
{
    instance = this;
}

Gateway::~Gateway()
{
    implementation.reset();
}

void Gateway::TransportUpdated(Transport<WPEFramework::Core::JSON::IElement>* transport)
{
    implementation->TransportUpdated(transport);
}
}

