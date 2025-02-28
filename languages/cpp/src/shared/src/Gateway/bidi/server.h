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

#include <string>
#include <map>
#include <list>
#include <mutex>

namespace FireboltSDK
{
    class Server
    {
        using DispatchFunctionEvent = std::function<void(void*, const void*, const string& parameters)>;

        struct CallbackDataEvent {
            const DispatchFunctionEvent lambda;
            void* usercb;
            const void* userdata;
        };

        using EventMap = std::map<std::string, CallbackDataEvent>;

        EventMap eventMap;
        mutable std::mutex eventMap_mtx;

        using DispatchFunctionProvider = std::function<std::string(const std::string &parameters, void*)>;

        struct Method {
            std::string name;
            JsonObject parameters;
            DispatchFunctionProvider lambda;
            void* usercb;
        };

        struct Interface {
            std::string name;
            std::list<Method> methods;
        };

        std::map<std::string, Interface> providers;
        mutable std::mutex providers_mtx;

        Config config;

        std::string getKeyFromEvent(const std::string &event)
        {
            std::string key = event;
            size_t dotPos = key.find('.');
            if (dotPos != std::string::npos && dotPos + 3 < key.size() && key.substr(dotPos + 1, 2) == "on") {
                key[dotPos + 3] = std::tolower(key[dotPos + 3]); // make lower-case the first latter after ".on"
                key.erase(dotPos + 1, 2); // erase "on"
            }
            return key;
        }

    public:
        Server(const Config &config_)
          : config(config_)
        {
        }

        virtual ~Server()
        {
            std::lock_guard lck(eventMap_mtx);
            eventMap.clear();
        }

        template <typename RESULT, typename CALLBACK>
        Firebolt::Error Subscribe(const std::string& event, JsonObject& parameters, const CALLBACK& callback, void* usercb, const void* userdata)
        {
            Firebolt::Error status = Firebolt::Error::General;

            std::function<void(void* usercb, const void* userdata, void* parameters)> actualCallback = callback;
            DispatchFunctionEvent implementation = [actualCallback](void* usercb, const void* userdata, const string& parameters) {
                WPEFramework::Core::ProxyType<RESULT>* inbound = new WPEFramework::Core::ProxyType<RESULT>();
                *inbound = WPEFramework::Core::ProxyType<RESULT>::Create();
                (*inbound)->FromString(parameters);
                actualCallback(usercb, userdata, static_cast<void*>(inbound));
            };
            CallbackDataEvent callbackData = {implementation, usercb, userdata};

            std::string key = getKeyFromEvent(event);

            std::lock_guard lck(eventMap_mtx);
            EventMap::iterator eventIndex = eventMap.find(key);
            if (eventIndex == eventMap.end()) {
                eventMap.emplace(std::piecewise_construct, std::forward_as_tuple(key), std::forward_as_tuple(callbackData));
                status = Firebolt::Error::None;
            }

            return status;
        }

        Firebolt::Error Unsubscribe(const std::string& event)
        {
            std::lock_guard lck(eventMap_mtx);
            return eventMap.erase(getKeyFromEvent(event)) > 0 ? Firebolt::Error::None : Firebolt::Error::General;
        }

        void Notify(const std::string &method, const std::string &parameters)
        {
            std::string key = method;
            std::lock_guard lck(eventMap_mtx);
            EventMap::iterator eventIt = eventMap.find(method);
            if (eventIt != eventMap.end()) {
                CallbackDataEvent& callback = eventIt->second;
                callback.lambda(callback.usercb, callback.userdata, parameters);
            }
        }

        void Request(Transport<WPEFramework::Core::JSON::IElement>* transport, unsigned id, const std::string &method, const std::string &parameters)
        {
            size_t dotPos = method.find('.');
            if (dotPos == std::string::npos) {
                return;
            }
            std::string interface = method.substr(0, dotPos);;
            std::string methodName = method.substr(dotPos + 1);
            std::lock_guard lck(providers_mtx);
            auto provider = providers.find(interface);
            if (provider == providers.end()) {
                return;
            }
            auto& methods = provider->second.methods;
            auto it = methods.begin();
            while (it != methods.end()) {
                it = std::find_if(it, methods.end(), [&methodName](const Method &m) { return m.name == methodName; });
                if (it != methods.end()) {
                    std::string response = it->lambda("{ \"parameters\":" + parameters + "}", it->usercb);
                    transport->SendResponse(id, response);
                    break;
                }
            }
        }

        template <typename RESPONSE, typename PARAMETERS, typename CALLBACK>
        Firebolt::Error RegisterProviderInterface(const std::string &fullMethod, const PARAMETERS &parameters, const CALLBACK &callback, void* usercb)
        {
            uint32_t waitTime = config.DefaultWaitTime;

            size_t dotPos = fullMethod.find('.');
            std::string interface = fullMethod.substr(0, dotPos);
            std::string method = fullMethod.substr(dotPos + 1);
            if (method.size() > 2 && method.substr(0, 2) == "on") {
                method[2] = std::tolower(method[2]);
                method.erase(0, 2); // erase "on"
            }

            std::function<std::string(void* usercb, void* params)> actualCallback = callback;
            DispatchFunctionProvider lambda = [actualCallback, method, waitTime](const std::string &params, void* usercb) {
                WPEFramework::Core::ProxyType<RESPONSE>* jsonParams = new WPEFramework::Core::ProxyType<RESPONSE>();
                *jsonParams = WPEFramework::Core::ProxyType<RESPONSE>::Create();
                (*jsonParams)->FromString(params);
                return actualCallback(usercb, jsonParams);
            };
            std::lock_guard lck(providers_mtx);
            if (providers.find(interface) == providers.end()) {
                Interface i = {
                    .name = interface,
                };
                i.methods.push_back({
                    .name = method,
                    .lambda = lambda,
                    .usercb = usercb,
                });
                providers[interface] = i;
            } else {
                auto &i = providers[interface];
                auto it = std::find_if(i.methods.begin(), i.methods.end(), [&method, usercb](const Method &m) { return m.name == method && m.usercb == usercb; });
                if (it == i.methods.end()) {
                    i.methods.push_back({
                        .name = method,
                        .lambda = lambda,
                        .usercb = usercb,
                    });
                }
            }
            return Firebolt::Error::None;
        }

        Firebolt::Error UnregisterProviderInterface(const std::string &interface, const std::string &method, void* usercb)
        {
            std::lock_guard lck(providers_mtx);
            try {
                Interface &i = providers.at(interface);
                auto it = std::find_if(i.methods.begin(), i.methods.end(), [&method, usercb](const Method &m) { return m.name == method && m.usercb == usercb; });
                if (it != i.methods.end()) {
                    i.methods.erase(it);
                }
            } catch (const std::out_of_range &e) {
            }
            return Firebolt::Error::None;
        }
    };
}

