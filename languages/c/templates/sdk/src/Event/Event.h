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

namespace FireboltSDK {

    static constexpr uint32_t DefaultWaitTime = 1000;

    class Event : public IEventHandler {
    public:
        typedef std::function<uint32_t(const void*, const string& parameters)> DispatchFunction;
    private:
        enum State : uint8_t {
            IDLE,
            EXECUTING,
            REVOKED
        };

        struct CallbackData {
            const DispatchFunction lambda;
            const void* userdata;
            State state;
        };
        using IdMap = std::map<uint32_t, CallbackData>;
        using EventMap = std::map<string, IdMap>;
  

        class Response : public WPEFramework::Core::JSON::Container {
        public:
            Response& operator=(const Response&) = delete;
            Response()
                : WPEFramework::Core::JSON::Container()
                , Listening(false)
            {
                Add(_T("listening"), &Listening);
            }
            Response(const Response& copy)
                : WPEFramework::Core::JSON::Container()
                , Listening(copy.Listening)
            {
                Add(_T("listening"), &Listening);
            }
            ~Response() override = default;

        public:
            WPEFramework::Core::JSON::Boolean Listening;
        };

    public:
        Event();
        ~Event() override;
        static Event& Instance();
        static void Dispose();
        void Configure(Transport<WPEFramework::Core::JSON::IElement>* transport);

    public:
        template <typename PARAMETERS, typename CALLBACK>
        uint32_t Subscribe(const string& eventName, const CALLBACK& callback, const void* userdata, uint32_t& id)
        {
            uint32_t status = FireboltSDKErrorUnavailable;
            if (_transport != nullptr) {

                status = Assign<PARAMETERS, CALLBACK>(eventName, callback, userdata, id);
                if (status == FireboltSDKErrorNone) {
                    const string parameters("{\"listen\":true}");
                    Response response;
                    status = _transport->Subscribe(eventName, parameters, response);

                    if (status != FireboltSDKErrorNone) {
                        Revoke(eventName, id);
                    } else if ((response.Listening.IsSet() == true) &&
                              (response.Listening.Value() == true)) {
                        status = FireboltSDKErrorNone;
                    } else {
                        status = FireboltSDKErrorNotSubscribed;
                    }
                }
            }

            return ((status == FireboltSDKErrorInUse) ? FireboltSDKErrorNone: status);
        }

        uint32_t Unsubscribe(const string& eventName, const uint32_t id);

    private:
        template <typename PARAMETERS, typename CALLBACK>
        uint32_t Assign(const string& eventName, const CALLBACK& callback, const void* userdata, uint32_t& id)
        {
            uint32_t status = FireboltSDKErrorNone;
            id = Id();
            std::function<void(const void* userdata, void* parameters)> actualCallback = callback;
            DispatchFunction implementation = [actualCallback](const void* userdata, const string& parameters) -> uint32_t {

                WPEFramework::Core::ProxyType<PARAMETERS> inbound = WPEFramework::Core::ProxyType<PARAMETERS>::Create();
                inbound->FromString(parameters);
                actualCallback(userdata, static_cast<void*>(&inbound));
                return (FireboltSDKErrorNone);
            };
            CallbackData callbackData = {implementation, userdata, State::IDLE};

            _adminLock.Lock();
            EventMap::iterator eventIndex = _eventMap.find(eventName);
            if (eventIndex != _eventMap.end()) {
                // Already registered, no need to register again;
                status = FireboltSDKErrorInUse;
                eventIndex->second.emplace(std::piecewise_construct, std::forward_as_tuple(id), std::forward_as_tuple(callbackData));
            } else {

                IdMap idMap;
                idMap.emplace(std::piecewise_construct, std::forward_as_tuple(id), std::forward_as_tuple(callbackData));
                _eventMap.emplace(std::piecewise_construct, std::forward_as_tuple(eventName), std::forward_as_tuple(idMap));

            }

            _adminLock.Unlock();
            return status;
        }
        uint32_t Revoke(const string& eventName, const uint32_t id);

    private:
        uint32_t Id() const
        {
            return (++_id);
        }
        uint32_t ValidateResponse(const WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message>& jsonResponse, bool& enabled) override;
        uint32_t Dispatch(const string& eventName, const WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message>& jsonResponse) override;
 
    private:
        mutable std::atomic<uint32_t> _id;
        EventMap _eventMap;
        WPEFramework::Core::CriticalSection _adminLock;
        Transport<WPEFramework::Core::JSON::IElement>* _transport;

        static Event* _singleton;
    };
}
