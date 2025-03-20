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

#include "../common.h"

#include "Transport/Transport.h"

#include <string>
#include <stdio.h>

namespace FireboltSDK
{

    using EventCallback = std::function<void(const std::string & /* eventName */, const JsonObject & /* parameters */, Firebolt::Error /* error */)>;

    class GatewayImpl
    {

        Transport<WPEFramework::Core::JSON::IElement>* transport;

    public:
        GatewayImpl()
        {
        }

    public:
        void TransportUpdated(Transport<WPEFramework::Core::JSON::IElement>* transport)
        {
           this->transport = transport;
        }

        template <typename RESPONSE>
        Firebolt::Error Request(const std::string &method, const JsonObject &parameters, RESPONSE &response)
        {
            if (transport == nullptr) {
                return Firebolt::Error::NotConnected;
            }
            return transport->Invoke(method, parameters, response);
        }

        template <typename RESPONSE>
        Firebolt::Error Subscribe(const string& event, const string& parameters, RESPONSE& response)
        {
            if (transport == nullptr) {
                return Firebolt::Error::NotConnected;
            }
            return transport->Subscribe(event, parameters, response);
        }

        Firebolt::Error Unsubscribe(const string& event, const string& parameters)
        {
            if (transport == nullptr) {
                return Firebolt::Error::NotConnected;
            }
            return transport->Unsubscribe(event, parameters);
        }

        template <typename RESPONSE, typename PARAMETERS, typename CALLBACK>
        Firebolt::Error RegisterProviderInterface(const std::string &method, const PARAMETERS &parameters, const CALLBACK& callback, void* usercb)
        {
            return Firebolt::Error::General;
        }

        Firebolt::Error UnregisterProviderInterface(const std::string &interface, const std::string &method, void* usercb)
        {
            return Firebolt::Error::General;
        }
    };
}

