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

#include "Accessor/Accessor.h"
#include "Event/Event.h"

namespace FireboltSDK {

    class Properties {
    public:
        Properties(const Properties&) = delete;
        Properties& operator= (const Properties&) = delete;

        Properties() = default;
        ~Properties() = default;

    public:
        template <typename RESPONSETYPE>
        static uint32_t Get(const string& propertyName, WPEFramework::Core::ProxyType<RESPONSETYPE>& response)
        {
            uint32_t status = FireboltSDKErrorUnavailable;
            Transport<WPEFramework::Core::JSON::IElement>* transport = Accessor::Instance().GetTransport();
            if (transport != nullptr) {
                JsonObject parameters;
                RESPONSETYPE responseType;
                status = transport->Invoke(propertyName, parameters, responseType);
                if (status == FireboltSDKErrorNone) {
                    ASSERT(response.IsValid() == false);
                    if (response.IsValid() == true) {
                        response.Release();
                    }
                    response = WPEFramework::Core::ProxyType<RESPONSETYPE>::Create();
                    (*response) = responseType;
                }
            } else {
                FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Accessor>(), "Error in getting Transport err = %d", status);
            }
 
            return status;
        }

        template <typename PARAMETERS>
        static uint32_t Set(const string& propertyName, const PARAMETERS& parameters)
        {
            uint32_t status = FireboltSDKErrorUnavailable;
            Transport<WPEFramework::Core::JSON::IElement>* transport = Accessor::Instance().GetTransport();
            if (transport != nullptr) {
                JsonObject responseType;
                status = transport->Invoke(propertyName, parameters, responseType);
            } else {
                FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Accessor>(), "Error in getting Transport err = %d", status);
            }

            return status;
        }

        template <typename PARAMETERS, typename CALLBACK>
        static uint32_t Subscribe(const string& propertyName, const CALLBACK& callback, const void* userdata, uint32_t& id)
        {
            return Event::Instance().Subscribe<PARAMETERS, CALLBACK>(EventName(propertyName), callback, userdata, id);
        }

        static uint32_t Unsubscribe(const string& propertyName, const uint32_t id)
        {
            return Event::Instance().Unsubscribe(EventName(propertyName), id);
        }
    private:
        static inline string EventName(const string& propertyName) {
            size_t pos = propertyName.find_first_of('.');
            return string(propertyName.substr(0, pos + 1) + "on" + propertyName.substr(pos + 1) + "Changed");
        }
    };
}
