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

#include "../common.h"
#include "client.h"
#include "server.h"

#include <string>

namespace FireboltSDK
{
    class ListeningResponse : public WPEFramework::Core::JSON::Container {
    public:
        ListeningResponse& operator=(const ListeningResponse&) = delete;
        ListeningResponse()
            : WPEFramework::Core::JSON::Container()
            , Listening(false)
        {
            Add(_T("listening"), &Listening);
        }
        ListeningResponse(const ListeningResponse& copy)
            : WPEFramework::Core::JSON::Container()
            , Listening(copy.Listening)
        {
            Add(_T("listening"), &Listening);
        }
        ~ListeningResponse() override = default;

    public:
        WPEFramework::Core::JSON::Boolean Listening;
    };

    class GatewayImpl : public ITransportReceiver
    {
        Config config;
        Client client;
        Server server;
        Transport<WPEFramework::Core::JSON::IElement>* transport;

        std::string jsonObject2String(const JsonObject &obj) {
            std::string s;
            obj.ToString(s);
            return s;
        }

    public:
        GatewayImpl()
          : client(config)
          , server(config)
        {
        }

        void TransportUpdated(Transport<WPEFramework::Core::JSON::IElement>* transport)
        {
            this->transport = transport;
            client.SetTransport(transport);
            if (transport != nullptr) {
                transport->SetTransportReceiver(this);
            }
        }

        virtual void Receive(const WPEFramework::Core::JSONRPC::Message& message) override
        {
            if (message.Designator.IsSet()) { // designator -> method
                if (message.Id.IsSet()) {
                    server.Request(message.Id.Value(), message.Designator.Value(), message.Parameters.Value());
                } else {
                    server.Notify(message.Designator.Value(), message.Parameters.Value());
                }
            } else {
                client.Response(message);
            }
        }

        template <typename RESPONSETYPE>
        Firebolt::Error Request(const std::string &method, const JsonObject &parameters, RESPONSETYPE &response)
        {
            if (transport == nullptr) {
                return Firebolt::Error::NotConnected;
            }
            return client.Request(method, parameters, response);
        }

        template <typename RESULT, typename CALLBACK>
        Firebolt::Error Subscribe(const string& event, JsonObject& parameters, const CALLBACK& callback, void* usercb, const void* userdata, bool prioritize = false)
        {
            if (transport == nullptr) {
                return Firebolt::Error::NotConnected;
            }

            Firebolt::Error status = server.Subscribe<RESULT>(event, parameters, callback, usercb, userdata);
            if (status != Firebolt::Error::None) {
                return status;
            }

            parameters.Set(_T("listen"), WPEFramework::Core::JSON::Variant(true));
            ListeningResponse response;
            status = client.Request(event, jsonObject2String(parameters), response);
            if (status == Firebolt::Error::None && (!response.Listening.IsSet() || !response.Listening.Value())) {
                status == Firebolt::Error::General;
            }
            if (status != Firebolt::Error::None) {
                server.Unsubscribe(event);
            }
            return status;
        }

        Firebolt::Error Unsubscribe(const string& event)
        {
            Firebolt::Error status = server.Unsubscribe(event);
            if (status != Firebolt::Error::None) {
                return status;
            }
            JsonObject parameters;
            parameters.Set(_T("listen"), WPEFramework::Core::JSON::Variant(false));
            ListeningResponse response;
            status = client.Request(event, jsonObject2String(parameters), response);
            if (status == Firebolt::Error::None && (!response.Listening.IsSet() || response.Listening.Value())) {
                status == Firebolt::Error::General;
            }
            return status;
        }

        Firebolt::Error RegisterProviderInterface(const std::string &capability, const std::string &interface, const std::string &method, const JsonObject &parameters, const ProviderCallback& callback)
        {
            return server.RegisterProviderInterface(capability, interface, method, parameters, callback);
        }

    };
}

