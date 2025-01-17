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

    class Async {
    private:
        Async();

    public:
        virtual ~Async();
        Async(const Async&) = delete;
        Async& operator= (const Async&) = delete;

        static Async& Instance();
        static void Dispose();
        void Configure(Transport<WPEFramework::Core::JSON::IElement>* transport);

    public:
        template <typename RESPONSE, typename PARAMETERS, typename CALLBACK>
        Firebolt::Error Invoke(const string& method, const PARAMETERS& parameters, const CALLBACK& callback, void* usercb, uint32_t waitTime = DefaultWaitTime)
        {
            std::string capability = "";
            size_t dotPos = method.find('.');
            if (dotPos == std::string::npos) {
                return Firebolt::Error::General;
            }
            std::string interface = method.substr(0, dotPos);;
            std::string methodName = method.substr(dotPos + 1);
            Firebolt::Error status = Gateway::Instance().RegisterProviderInterface<RESPONSE>(capability, interface, methodName, parameters, callback, usercb);
            return status;
        }

        Firebolt::Error Abort(const string& method, void* usercb)
        {
            RemoveEntry(method, usercb);
            return Firebolt::Error::None;
        }

        void RemoveEntry(const string& method, void* usercb)
        {
            size_t dotPos = method.find('.');
            if (dotPos == std::string::npos) {
                return;
            }
            std::string interface = method.substr(0, dotPos);;
            std::string methodName = method.substr(dotPos + 1);
            Gateway::Instance().UnregisterProviderInterface(interface, methodName, usercb);
        }

    private:
        void Clear();

    private:
        static constexpr uint32_t DefaultWaitTime = WPEFramework::Core::infinite;

        static Async* _singleton;
    };
}
