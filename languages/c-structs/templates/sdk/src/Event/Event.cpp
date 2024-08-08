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

#include "Transport/Transport.h"
#include "Event.h"

namespace FireboltSDK {
    Event* Event::_singleton = nullptr;
    Event::Event()
        : _eventMap()
        , _adminLock()
        , _transport(nullptr)
    {
        ASSERT(_singleton == nullptr);
        _singleton = this;
    }

    Event::~Event() /* override */
    {
        _transport->SetEventHandler(nullptr);
        _transport = nullptr;

        _singleton = nullptr;
    }

    /* static */ Event& Event::Instance()
    {
        static Event *instance = new Event();
        ASSERT(instance != nullptr);
        return *instance;
    }

    /* static */ void Event::Dispose()
    {
        ASSERT(_singleton != nullptr);

        if (_singleton != nullptr) {
            delete _singleton;
        }
    }

    void Event::Configure(Transport<WPEFramework::Core::JSON::IElement>* transport)
    {
        _transport = transport;
        _transport->SetEventHandler(this);
    }

    uint32_t Event::Unsubscribe(const string& eventName, void* usercb)
    {
        uint32_t status = Revoke(eventName, usercb);

        if (status == FireboltSDKErrorNone) {
            if (_transport != nullptr) {

                const string parameters("{\"listen\":false}");
                status = _transport->Unsubscribe(eventName, parameters);
            }
        }
        return ((status == FireboltSDKErrorInUse) ? FireboltSDKErrorNone: status);
    }

    uint32_t Event::ValidateResponse(const WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message>& jsonResponse, bool& enabled) /* override */
    {
        uint32_t result = FireboltSDKErrorGeneral;
        Response response;
        _transport->FromMessage((WPEFramework::Core::JSON::IElement*)&response, *jsonResponse);
        if (response.Listening.IsSet() == true) {
            result = FireboltSDKErrorNone;
            enabled = response.Listening.Value();
        }
        return result;
    }

    uint32_t Event::Dispatch(const string& eventName, const WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message>& jsonResponse) /* override */
    {
        string response = jsonResponse->Result.Value();
        _adminLock.Lock();
        EventMap::iterator eventIndex = _eventMap.find(eventName);
        if (eventIndex != _eventMap.end()) {
            CallbackMap::iterator callbackIndex = eventIndex->second.begin();
            while(callbackIndex != eventIndex->second.end()) {
                State state;
                if (callbackIndex->second.state != State::REVOKED) {
                    callbackIndex->second.state = State::EXECUTING;
                }
                state = callbackIndex->second.state;
                _adminLock.Unlock();
                if (state == State::EXECUTING) {
                    callbackIndex->second.lambda(callbackIndex->first, callbackIndex->second.userdata, (jsonResponse->Result.Value()));
                }
                _adminLock.Lock();
                if (callbackIndex->second.state == State::REVOKED) {
                    callbackIndex = eventIndex->second.erase(callbackIndex);
                    if (eventIndex->second.size() == 0) {
                        _eventMap.erase(eventIndex);
                    }
                } else {
                    callbackIndex->second.state = State::IDLE;
                    callbackIndex++;
                }
            }
        }
        _adminLock.Unlock();

        return FireboltSDKErrorNone;;
    }

    uint32_t Event::Revoke(const string& eventName, void* usercb)
    {
        uint32_t status = FireboltSDKErrorNone;
        _adminLock.Lock();
        EventMap::iterator eventIndex = _eventMap.find(eventName);
        if (eventIndex != _eventMap.end()) {
            CallbackMap::iterator callbackIndex = eventIndex->second.find(usercb);
            if (callbackIndex->second.state != State::EXECUTING) {
                if (callbackIndex != eventIndex->second.end()) {
                    eventIndex->second.erase(callbackIndex);
                }
            } else {
                callbackIndex->second.state = State::REVOKED;
            }
            if (eventIndex->second.size() == 0) {
                _eventMap.erase(eventIndex);
            } else {
                status = FireboltSDKErrorInUse;
            }
        }
        _adminLock.Unlock();

        return status;
    }
}
