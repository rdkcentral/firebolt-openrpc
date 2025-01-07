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

#include "error.h"
#include "Accessor/Accessor.h"

#include <string>
#include <stdio.h>

namespace FireboltSDK
{

    using EventCallback = std::function<void(const std::string & /* eventName */, const JsonObject & /* parameters */, Firebolt::Error /* error */)>;

    class Client
    {
        Firebolt::Error Request(const std::string &method, const JsonObject &parameters)
        {
            return Firebolt::Error::None;
        }
    };

    class Server
    {
        Firebolt::Error Subscribe(const std::string &eventName, const EventCallback &callback)
        {
            return Firebolt::Error::None;
        }

        Firebolt::Error Request(const std::string &methodName, const JsonObject &parameters)
        {
            return Firebolt::Error::None;
        }

        Firebolt::Error Notify()
        {
            return Firebolt::Error::None;
        }
    };

    class Provider
    {
        // TBD
    };

    class GatewayImpl : public Gateway
    {
        Client _client;
        Server _server;

        void receive(const JsonObject &response)
        {

        }

    public:
        void TransportUpdated(Transport<WPEFramework::Core::JSON::IElement>* transport)
        {
        }

        Firebolt::Error Request(const std::string &method, const JsonObject &parameters, JsonObject &response)
        {
            return _client.Request(method, parameters);
        }

        virtual Firebolt::Error Subscribe(const std::string &eventName, const EventCallback &callback)
        {
            return _server.Subscribe(eventName, callback);
        }

        virtual Firebolt::Error Unsubsribe(const std::string &eventName)
        {
            return Firebolt::Error::None;
        }

        virtual Firebolt::Error Provide(const std::string &interfaceName, const Provider &provider)
        {
            return Firebolt::Error::None;
        }
    }
}

