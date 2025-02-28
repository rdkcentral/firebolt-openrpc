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

#include "common.h"

#include <functional>
#include <string>

#ifdef GATEWAY_BIDIRECTIONAL
#include "bidi/gateway_impl.h"
#else
#include "unidi/gateway_impl.h"
#endif

namespace FireboltSDK
{
    class Gateway
    {
        static Gateway *instance;

        std::unique_ptr<GatewayImpl> implementation;

    private:
        Gateway(std::unique_ptr<GatewayImpl> implementation);

    public:
        Gateway(const Gateway&) = delete;
        Gateway& operator=(const Gateway&) = delete;
        virtual ~Gateway();

        static Gateway& Instance();
        static void Dispose();

        void TransportUpdated(Transport<WPEFramework::Core::JSON::IElement>* transport);

        template <typename RESPONSE>
        Firebolt::Error Request(const std::string &method, const JsonObject &parameters, RESPONSE &response)
        {
            return implementation->Request(method, parameters, response);
        }

#ifdef GATEWAY_BIDIRECTIONAL
        template <typename RESULT, typename CALLBACK>
        Firebolt::Error Subscribe(const string& event, JsonObject& parameters, const CALLBACK& callback, void* usercb, const void* userdata, bool prioritize = false)
        {
            return implementation->Subscribe<RESULT>(event, parameters, callback, usercb, userdata, prioritize);
        }

        Firebolt::Error Unsubscribe(const std::string& event)
        {
            return implementation->Unsubscribe(event);
        }
#else
        template <typename RESPONSE>
        Firebolt::Error Subscribe(const string& event, const string& parameters, RESPONSE& response)
        {
            return implementation->Subscribe(event, parameters, response);
        }

        Firebolt::Error Unsubscribe(const string& event, const string& parameters)
        {
            return implementation->Unsubscribe(event, parameters);
        }
#endif
        template <typename RESPONSE, typename PARAMETERS, typename CALLBACK>
        Firebolt::Error RegisterProviderInterface(const std::string &method, const PARAMETERS &parameters, const CALLBACK& callback, void* usercb)
        {
            return implementation->RegisterProviderInterface<RESPONSE>(method, parameters, callback, usercb);
        }

        Firebolt::Error UnregisterProviderInterface(const std::string &interface, const std::string &method, void* usercb)
        {
            return implementation->UnregisterProviderInterface(interface, method, usercb);
        }
    };
}

