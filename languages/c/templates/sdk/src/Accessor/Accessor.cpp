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

#include "Accessor.h"

namespace FireboltSDK {

    Accessor* Accessor::_singleton = nullptr;
    Accessor::Accessor()
        : _threadCount(DefaultThreadCount)
        , _queueSize(DefaultQueueSize)
        , _workerPool()
        , _transport(nullptr)
    {
        _singleton = this;
        Config config;
        LoadConfigs(config);

        Logger::SetLogLevel(WPEFramework::Core::EnumerateType<Logger::LogLevel>(config.LogLevel.Value().c_str()).Value());
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Accessor>(), "Url = %s", config.Url.Value().c_str());
        CreateTransport(config.Url.Value(), config.WaitTime.Value());
        CreateEventHandler();

        _workerPool = WPEFramework::Core::ProxyType<WorkerPoolImplementation>::Create(_threadCount, WPEFramework::Core::Thread::DefaultStackSize(), _queueSize);
        WPEFramework::Core::WorkerPool::Assign(&(*_workerPool));
        _workerPool->Run();
    }

    Accessor::~Accessor()
    {
        DestroyTransport();
        DestroyEventHandler();
        WPEFramework::Core::IWorkerPool::Assign(nullptr);
        _workerPool->Stop();
        _singleton = nullptr;
    }

    void Accessor::LoadConfigs(Config& config)
    {
        string prefixPath;
        WPEFramework::Core::SystemInfo::GetEnvironment("OPENRPC_NATIVE_SDK_PREFIX", prefixPath);
        string configFilePath = (prefixPath.empty() != true) ?
                                (prefixPath + '/' + Accessor::ConfigFile) : Accessor::ConfigFile;
        WPEFramework::Core::File configFile(configFilePath);

        if (configFile.Open(true) == true) {
            WPEFramework::Core::OptionalType<WPEFramework::Core::JSON::Error> error;
            config.IElement::FromFile(configFile, error);
            if (error.IsSet() == true) {
                FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Accessor>(), "Error in reading config");
            }
        }
    }

    uint32_t Accessor::CreateEventHandler()
    {
         Event::Instance().Configure(_transport);
         return FireboltSDKErrorNone;
    }

    uint32_t Accessor::DestroyEventHandler()
    {
         Event::Dispose();
         return FireboltSDKErrorNone;
    }

    Event& Accessor::GetEventManager()
    {
        return Event::Instance();
    }

    uint32_t Accessor::CreateTransport(const string& url, const uint32_t waitTime)
    {
        if (_transport != nullptr) {
            delete _transport;
        }

        _transport = new Transport<WPEFramework::Core::JSON::IElement>(static_cast<WPEFramework::Core::URL>(url), waitTime);
        if (WaitForLinkReady(_transport, DefaultWaitTime) != FireboltSDKErrorNone) {
            delete _transport;
            _transport = nullptr;
        }

        ASSERT(_transport != nullptr);
        return ((_transport != nullptr) ? FireboltSDKErrorNone : FireboltSDKErrorUnavailable);
    }

    uint32_t Accessor::DestroyTransport()
    {
        if (_transport != nullptr) {
            delete _transport;
            _transport = nullptr;
        }
        return FireboltSDKErrorNone;
    }

    Transport<WPEFramework::Core::JSON::IElement>* Accessor::GetTransport()
    {
        ASSERT(_transport != nullptr);
        return _transport;
    }

    uint32_t Accessor::WaitForLinkReady(Transport<WPEFramework::Core::JSON::IElement>* transport, const uint32_t waitTime = DefaultWaitTime) {
        uint32_t waiting = (waitTime == WPEFramework::Core::infinite ? WPEFramework::Core::infinite : waitTime);
        static constexpr uint32_t SLEEPSLOT_TIME = 100;

        // Right, a wait till connection is closed is requested..
        while ((waiting > 0) && (transport->IsOpen() == false)) {

            uint32_t sleepSlot = (waiting > SLEEPSLOT_TIME ? SLEEPSLOT_TIME : waiting);

            // Right, lets sleep in slices of 100 ms
            SleepMs(sleepSlot);

            waiting -= (waiting == WPEFramework::Core::infinite ? 0 : sleepSlot);
        }
        return (((waiting == 0) || (transport->IsOpen() == true)) ? FireboltSDKErrorNone : FireboltSDKErrorTimedout);
    }
}
