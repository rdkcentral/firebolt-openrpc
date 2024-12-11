/*
 * Copyright 2024 Comcast Cable Communications Management, LLC
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

#ifndef MODULE_NAME
#define MODULE_NAME OpenRPCNativeSDK
#endif
#include <core/core.h>
#include "error.h"

#include "Transport/Transport.h"

#include <functional>
#include <string>

#ifdef GATEWAY_BIDIRECTIONAL
#include "gateway_impl_bidi.h"
#else
#include "gateway_impl_unidi.h"
#endif

namespace FireboltSDK
{
    using EventCallback = std::function<void(const std::string & /* eventName */, const JsonObject & /* parameters */, Firebolt::Error /* error */)>;

    class Gateway
    {
        static Gateway *_instance;

        GatewayImpl *_implementation;

    private:
        Gateway(GatewayImpl *implementation);

    public:
        Gateway(const Gateway&) = delete;
        Gateway& operator=(const Gateway&) = delete;
        ~Gateway();

        static Gateway& Instance();
        static void Dispose();

        void Configure(Transport<WPEFramework::Core::JSON::IElement>* transport);

        template <typename RESPONSETYPE>
        Firebolt::Error Request(const std::string &method, const JsonObject &parameters, RESPONSETYPE &response)
        {
            return _implementation->Request(method, parameters, response);
        }

        template <typename RESPONSETYPE>
        Firebolt::Error Subscribe(const string& event, const string& parameters, RESPONSETYPE& response)
        {
            return _implementation->Subscribe(event, parameters, response);
        }

        Firebolt::Error Unsubscribe(const string& event, const string& parameters)
        {
            return _implementation->Unsubscribe(event, parameters);
        }

    };
}

