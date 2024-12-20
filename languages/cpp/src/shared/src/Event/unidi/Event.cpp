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
        : _internalEventMap()
        , _externalEventMap()
        , _adminLock()
    {
        ASSERT(_singleton == nullptr);
        _singleton = this;
    }

    Event::~Event() /* override */
    {
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
        transport->SetEventHandler(this);
    }

    Firebolt::Error Event::Unsubscribe(const string& eventName, void* usercb)
    {
        Firebolt::Error status = Revoke(eventName, usercb);

        if (status == Firebolt::Error::None) {
            const string parameters("{\"listen\":false}");
            status = Gateway::Instance().Unsubscribe(eventName, parameters);
        } else {
            status = Firebolt::Error::None;
        }
        return status;
    }

    Firebolt::Error Event::ValidateResponse(const WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message>& jsonResponse, bool& enabled) /* override */
    {
        Firebolt::Error result = Firebolt::Error::General;
        Response response;
        response.FromString(jsonResponse->Result.Value());
        if (response.Listening.IsSet() == true) {
            result = Firebolt::Error::None;
            enabled = response.Listening.Value();
        }
        return result;
    }
    
    
    /* This function combines both internal and external event maps, and iterates over them to find the specified event.
       If the event is found, it iterates over its associated callbacks, updating their states and executing them if applicable.
       Callbacks in the REVOKED state are removed. 
    */
    Firebolt::Error Event::Dispatch(const string& eventName, const WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message>& jsonResponse) /* override */
    {
        string response = jsonResponse->Result.Value();
        std::vector<EventMap*> eventMaps = {&_internalEventMap, &_externalEventMap};

        // Combine both _internalEventMap and _externalEventMap into a single loop
        for (auto eventMap : eventMaps) {        
            _adminLock.Lock();
            EventMap::iterator eventIndex = eventMap->find(eventName);
            if (eventIndex != eventMap->end()) {
                CallbackMap& callbacks = eventIndex->second;
                for (CallbackMap::iterator callbackIndex = callbacks.begin(); callbackIndex != callbacks.end();) {
                    State state;
                    if (callbackIndex->second.state != State::REVOKED) {
                        callbackIndex->second.state = State::EXECUTING;
                    }
                    state = callbackIndex->second.state;
                    _adminLock.Unlock();
                    if (state == State::EXECUTING) {
                        callbackIndex->second.lambda(callbackIndex->first, callbackIndex->second.userdata, response);
                    }
                    _adminLock.Lock();
                    if (callbackIndex->second.state == State::REVOKED) {
                        callbackIndex = callbacks.erase(callbackIndex);
                        if (callbacks.empty()) {
                            eventMap->erase(eventIndex); // Erase from the correct eventMap
                            break; // No need to continue iterating if map is empty
                        }
                    } else {
                        callbackIndex->second.state = State::IDLE;
                        ++callbackIndex;
                    }
                }
            }
            _adminLock.Unlock();
        }
        return Firebolt::Error::None;
    }


    Firebolt::Error Event::Revoke(const string& eventName, void* usercb)
    {
        Firebolt::Error status = Firebolt::Error::None;

        // Combine both _internalEventMap and _externalEventMap into a single loop
        std::vector<EventMap*> eventMaps = {&_internalEventMap, &_externalEventMap};

        for (auto eventMap : eventMaps) { 
            _adminLock.Lock(); // Lock inside the loop

            // Find the eventIndex for eventName in the current eventMap
            EventMap::iterator eventIndex = eventMap->find(eventName);
            if (eventIndex != eventMap->end()) {
                // Find the callbackIndex for usercb in the current CallbackMap
                CallbackMap::iterator callbackIndex = eventIndex->second.find(usercb);
                if (callbackIndex != eventIndex->second.end()) {
                    // Check if callback is not executing, then erase it
                    if (callbackIndex->second.state != State::EXECUTING) {
                        eventIndex->second.erase(callbackIndex);
                    } else {
                        // Mark the callback as revoked
                        callbackIndex->second.state = State::REVOKED;
                    }

                    // Check if the CallbackMap is empty after potential erasure
                    if (eventIndex->second.empty()) {
                        eventMap->erase(eventIndex);
                    } else {
                        // Set status to General error if CallbackMap is not empty
                        status = Firebolt::Error::General;
                    }
                }
            }

            _adminLock.Unlock(); // Unlock after processing each eventMap
        }

        return status;
    }

    void Event::Clear()
    {
        // Clear both _internalEventMap and _externalEventMap
        std::vector<EventMap*> eventMaps = {&_internalEventMap, &_externalEventMap};

        for (auto eventMap : eventMaps) { 
            _adminLock.Lock(); // Lock before clearing

            EventMap::iterator eventIndex = eventMap->begin();
            while (eventIndex != eventMap->end()) {
                CallbackMap::iterator callbackIndex = eventIndex->second.begin();
                while (callbackIndex != eventIndex->second.end()) {
                    callbackIndex = eventIndex->second.erase(callbackIndex);
                }
                eventIndex = eventMap->erase(eventIndex);
            }

            _adminLock.Unlock(); // Unlock after clearing
        }
    }

}
