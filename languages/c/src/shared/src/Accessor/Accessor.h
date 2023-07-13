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
#include "WorkerPool.h"
#include "Transport/Transport.h"
#include "Event/Event.h"
#include "Logger/Logger.h"

namespace FireboltSDK {
    class Accessor {
    private:
        static constexpr uint8_t JSONVersion = 2;

    private:
        //Singleton
        Accessor(const string& configLine);

    public:
        class EXTERNAL Config : public WPEFramework::Core::JSON::Container {
        public:
            Config(const Config&) = delete;
            Config& operator=(const Config&) = delete;

            class WorkerPoolConfig : public WPEFramework::Core::JSON::Container {
                public:
                    WorkerPoolConfig& operator=(const WorkerPoolConfig&);

                    WorkerPoolConfig()
                        : WPEFramework::Core::JSON::Container()
                        , QueueSize(8)
                        , ThreadCount(3)
                        , StackSize(WPEFramework::Core::Thread::DefaultStackSize())
                    {
                        Add("queueSize", &QueueSize);
                        Add("threadCount", &ThreadCount);
                        Add("stackSize", &StackSize);
                    }

                    virtual ~WorkerPoolConfig() = default;

                public:
                    WPEFramework::Core::JSON::DecUInt32 QueueSize;
                    WPEFramework::Core::JSON::DecUInt32 ThreadCount;
                    WPEFramework::Core::JSON::DecUInt32 StackSize;
                };


            Config()
                : WPEFramework::Core::JSON::Container()
                , WaitTime(1000)
                , LogLevel(_T("Info"))
                , WorkerPool()
                , WsUrl(_T("ws://127.0.0.1:9998"))
            {
                Add(_T("waitTime"), &WaitTime);
                Add(_T("logLevel"), &LogLevel);
                Add(_T("workerPool"), &WorkerPool);
                Add(_T("wsUrl"), &WsUrl);
            }

        public:
            WPEFramework::Core::JSON::DecUInt32 WaitTime;
            WPEFramework::Core::JSON::String LogLevel;
            WorkerPoolConfig WorkerPool;
            WPEFramework::Core::JSON::String WsUrl;
        };

        Accessor(const Accessor&) = delete;
        Accessor& operator= (const Accessor&) = delete;
        Accessor() = delete;
        ~Accessor();

        static Accessor& Instance(const string& configLine = "")
        {
            static Accessor *instance = new Accessor(configLine);
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
        Event& GetEventManager();
        Transport<WPEFramework::Core::JSON::IElement>* GetTransport();

    private:
        uint32_t CreateEventHandler();
        uint32_t DestroyEventHandler();
        uint32_t CreateTransport(const string& url, const uint32_t waitTime);
        uint32_t DestroyTransport();
        uint32_t WaitForLinkReady(Transport<WPEFramework::Core::JSON::IElement>* transport, const uint32_t waitTime);

    private:
        WPEFramework::Core::ProxyType<WorkerPoolImplementation> _workerPool;
        Transport<WPEFramework::Core::JSON::IElement>* _transport;
        static Accessor* _singleton;
        Config _config;
    };
}
