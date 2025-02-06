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
#include "Async/Async.h"
#include "Event/Event.h"
#include "Gateway/Gateway.h"
#include "Logger/Logger.h"

#include <condition_variable>
#include <mutex>

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
#ifdef GATEWAY_BIDIRECTIONAL
                , RPCv2(true)
#endif
            {
                Add(_T("waitTime"), &WaitTime);
                Add(_T("logLevel"), &LogLevel);
                Add(_T("workerPool"), &WorkerPool);
                Add(_T("wsUrl"), &WsUrl);
#ifdef GATEWAY_BIDIRECTIONAL
                Add(_T("rpcV2"), &RPCv2);
#endif
            }

        public:
            WPEFramework::Core::JSON::DecUInt32 WaitTime;
            WPEFramework::Core::JSON::String LogLevel;
            WorkerPoolConfig WorkerPool;
            WPEFramework::Core::JSON::String WsUrl;
#ifdef GATEWAY_BIDIRECTIONAL
            WPEFramework::Core::JSON::Boolean RPCv2;
#endif
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
                _singleton = nullptr;
            }
        }

        Firebolt::Error Connect(const Transport<WPEFramework::Core::JSON::IElement>::Listener& listener)
        {
            RegisterConnectionChangeListener(listener);
            Firebolt::Error status = CreateTransport(_config.WsUrl.Value().c_str(), _config.WaitTime.Value());
            if (status == Firebolt::Error::None) {
                Async::Instance().Configure(_transport);
                Gateway::Instance().TransportUpdated(_transport);
                status = CreateEventHandler();
            }
            running = true;
            reconnector = std::thread(std::bind(&Accessor::Reconnector, this));
            return status;
        }

        void RegisterConnectionChangeListener(const Transport<WPEFramework::Core::JSON::IElement>::Listener& listener)
        {
            _connectionChangeListener = listener;
        }

        void UnregisterConnnectionChangeListener()
        {
            _connectionChangeListener = nullptr;
        }

        Firebolt::Error Disconnect()
        {
            running = false;
            _connectionChangeSync.signal(); // Signal to reconnect
            if (reconnector.joinable()) {
                reconnector.join();
            }
            return Firebolt::Error::None;
        }

        bool IsConnected() const
        {
            return _connected;
        }

        Event& GetEventManager();

    private:
        Firebolt::Error CreateEventHandler();
        Firebolt::Error DestroyEventHandler();
        Firebolt::Error CreateTransport(const string& url, const uint32_t waitTime);
        Firebolt::Error DestroyTransport();

        void ConnectionChanged(const bool connected, const Firebolt::Error error);
        void Reconnector();

    private:
        WPEFramework::Core::ProxyType<WorkerPoolImplementation> _workerPool;
        Transport<WPEFramework::Core::JSON::IElement>* _transport;
        static Accessor* _singleton;
        Config _config;
        struct {
            std::mutex m;
            std::condition_variable cv;
            bool ready = false;
            void wait() {
                std::unique_lock lk(m);
                cv.wait(lk, [&]{ return ready; });
                lk.unlock();
                ready = false;
            }
            void signal() {
                std::lock_guard lk(m);
                ready = true;
                cv.notify_one();
            }
        } _connectionChangeSync; // Synchronize a thread that is waiting for a connection if that one that is notified about connection changes

        bool _connected = false;
        std::atomic<bool> running { false };
        std::thread reconnector;
        Transport<WPEFramework::Core::JSON::IElement>::Listener _connectionChangeListener = nullptr;
    };
}
