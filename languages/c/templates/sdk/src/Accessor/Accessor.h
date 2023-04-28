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
#include "Config.h"
#include "WorkerPool.h"
#include "Transport/Transport.h"
#include "Event/Event.h"
#include "Logger/Logger.h"

namespace FireboltSDK {
    class Accessor {
    private:
        static constexpr uint8_t JSONVersion = 2;
        static constexpr const TCHAR* ConfigFile = _T("/etc/Firebolt/config.json");
        static constexpr uint32_t DefaultWaitTime = 1000;
        static constexpr uint8_t DefaultQueueSize = 8;
        static constexpr uint8_t DefaultThreadCount = 3;

    public:
        Accessor(const Accessor&) = delete;
        Accessor& operator= (const Accessor&) = delete;

        Accessor();
        ~Accessor();

        static Accessor& Instance()
        {
            static Accessor *instance = new Accessor();
            ASSERT(instance != nullptr);
            return *instance;
        }

        static void Dispose()
        {
            ASSERT(_singleton != nullptr);

            if (_singleton != nullptr) {
                delete _singleton;
            }
        }

        uint32_t CreateEventHandler();
        uint32_t DestroyEventHandler();
        Event& GetEventManager();

        uint32_t CreateTransport(const string& url, const uint32_t waitTime);
        uint32_t DestroyTransport();
        Transport<WPEFramework::Core::JSON::IElement>* GetTransport();
        uint32_t WaitForLinkReady(Transport<WPEFramework::Core::JSON::IElement>* transport, const uint32_t waitTime);

    private:
        void LoadConfigs(Config& config);

    private:
        uint8_t _threadCount;
        uint8_t _queueSize;
        WPEFramework::Core::ProxyType<WorkerPoolImplementation> _workerPool;
        Transport<WPEFramework::Core::JSON::IElement>* _transport;
        static Accessor* _singleton;
    };
}
