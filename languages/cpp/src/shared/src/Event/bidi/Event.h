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

#include "Module.h"
#include "Gateway/Gateway.h"

namespace FireboltSDK {

    class Event {
    private:
        static Event* _singleton;

    private:
        Event()
        {
            ASSERT(_singleton == nullptr);
            _singleton = this;
        }

    public:
        virtual ~Event()
        {
            _singleton = nullptr;
        }

        static Event& Instance();
        static void Dispose();
        void Configure(Transport<WPEFramework::Core::JSON::IElement>* transport) {}

    public:
        template <typename RESULT, typename CALLBACK>
        Firebolt::Error Subscribe(const string& eventName, const CALLBACK& callback, void* usercb, const void* userdata)
        {
            JsonObject jsonParameters;
            return Subscribe<RESULT, CALLBACK>(eventName, jsonParameters, callback, usercb, userdata);
        }

        template <typename RESULT, typename CALLBACK>
        Firebolt::Error Subscribe(const string& eventName, JsonObject& jsonParameters, const CALLBACK& callback, void* usercb, const void* userdata, bool prioritize = false)
        {
            return Gateway::Instance().Subscribe<RESULT>(eventName, jsonParameters, callback, usercb, userdata, prioritize);
        }

        Firebolt::Error Unsubscribe(const string& eventName, void* usercb)
        {
            return Gateway::Instance().Unsubscribe(eventName);
        }

        template <typename RESULT, typename CALLBACK>
        Firebolt::Error Prioritize(const string& eventName,JsonObject& jsonParameters, const CALLBACK& callback, void* usercb, const void* userdata)
        {
            Firebolt::Error status = Firebolt::Error::General;
            return status;
        }
    };
}
