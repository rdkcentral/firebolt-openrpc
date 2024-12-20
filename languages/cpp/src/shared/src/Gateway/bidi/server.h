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

#include <string>
#include <map>
#include <list>
#include <mutex>

namespace FireboltSDK
{
    class Server
    {
        using DispatchFunction = std::function<Firebolt::Error(void*, const void*, const string& parameters)>;

        struct CallbackData {
            const DispatchFunction lambda;
            void* usercb;
            const void* userdata;
        };

        using EventMap = std::map<std::string, CallbackData>;

        EventMap eventMap;
        mutable std::mutex eventMap_mtx;

        struct Method {
            std::string name;
            JsonObject parameters;
            ProviderCallback callback;
        };

        struct Interface {
            std::string capability;
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
            DispatchFunction implementation = [actualCallback](void* usercb, const void* userdata, const string& parameters) -> Firebolt::Error {
                WPEFramework::Core::ProxyType<RESULT>* inbound = new WPEFramework::Core::ProxyType<RESULT>();
                *inbound = WPEFramework::Core::ProxyType<RESULT>::Create();
                (*inbound)->FromString(parameters);
                actualCallback(usercb, userdata, static_cast<void*>(inbound));
                return (Firebolt::Error::None);
            };
            CallbackData callbackData = {implementation, usercb, userdata};

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
                CallbackData& callback = eventIt->second;
                callback.lambda(callback.usercb, callback.userdata, parameters);
            }
        }

        void Request(const WPEFramework::Core::JSONRPC::Message& message)
        {
        }

        void Request(const std::string &methodFullName, const JsonObject &parameters)
        {
            size_t dotPos = methodFullName.find('.');
            if (dotPos == std::string::npos) {
                return;
            }
            std::string interface = methodFullName.substr(0, dotPos);;
            std::string methodName = methodFullName.substr(dotPos + 1);
            std::lock_guard lck(providers_mtx);
            auto provider = providers.find(interface);
            if (provider == providers.end()) {
                return;
            }
            auto& methods = provider->second.methods;
            auto it = methods.begin();
            while (it != methods.end()) {
                if ((it = std::find_if(it, methods.end(), [&methodName](const Method &m) { return m.name == methodName; })) != methods.end()) {
                    auto& m = *it;
                    m.callback(parameters);
                }
            }
        }

        Firebolt::Error RegisterProviderInterface(const std::string &capability, const std::string &interface, const std::string &method, const JsonObject &parameters, const ProviderCallback &callback)
        {
            Interface i;
            std::lock_guard lck(providers_mtx);
            if (providers.find(interface) == providers.end()) {
                i = {
                    .capability = capability,
                    .name = interface,
                };
            } else {
                i = providers[interface];
            }
            i.methods.push_back({
                    .name = method,
                    .parameters = parameters,
                    .callback = callback
                    });
            return Firebolt::Error::None;
        }
    };
}

