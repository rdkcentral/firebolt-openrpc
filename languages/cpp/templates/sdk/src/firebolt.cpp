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

#include <firebolt.h>
#include "FireboltSDK.h"
#include "IModule.h"
${module.includes.private}

namespace Firebolt {

    class FireboltAccessorImpl : public IFireboltAccessor {
    private:
        using ModuleMap = std::unordered_map<string, IModule*>;

    private:
        FireboltAccessorImpl()
            : _accessor(nullptr)
        {
            ASSERT(_singleton == nullptr);
            _singleton = this;
        }
    public:
        FireboltAccessorImpl(const FireboltAccessorImpl&) = delete;
        FireboltAccessorImpl& operator=(const FireboltAccessorImpl&) = delete;

        ~FireboltAccessorImpl()
        {
            if (_accessor != nullptr) {
                _accessor->Dispose();
                _accessor = nullptr;
            }

            ASSERT(_singleton != nullptr);
            _singleton = nullptr;
        }

        static FireboltAccessorImpl& Instance()
        {
            if (_singleton == nullptr) {
                _singleton = new FireboltAccessorImpl();
                ASSERT(_singleton != nullptr);
            }
            return *_singleton;
        }

        static void Dispose()
        {
            ModuleMap::iterator module = _moduleMap.begin();
            while (module != _moduleMap.end()) {
                delete module->second;
                module = _moduleMap.erase(module);
            }

            ASSERT(_singleton != nullptr);
            if (_singleton != nullptr) {
                delete _singleton;
                _singleton = nullptr;
            }
        }

        Firebolt::Error Initialize( const std::string& configLine ) override
        {
            _accessor = &(FireboltSDK::Accessor::Instance(configLine));
            return Error::None;
        }

        Firebolt::Error Deinitialize() override
        {
            return Error::None;
        }

        Firebolt::Error Connect( OnConnectionChanged listener ) override
        {
            return _accessor->Connect(listener);
        }

        void RegisterConnectionChangeListener( OnConnectionChanged listener ) override
        {
            return _accessor->RegisterConnectionChangeListener(listener);
        }

        void UnregisterConnnectionChangeListener() override
        {
            _accessor->UnregisterConnnectionChangeListener();
        }

        bool IsConnected() const override
        {
            return _accessor->IsConnected();
        }

        Firebolt::Error Disconnect() override
        {
            return _accessor->Disconnect();
        }

        void ErrorListener(OnError notification) override
        {
        }

${module.init}
    private:
        FireboltSDK::Accessor* _accessor;
        static FireboltAccessorImpl* _singleton;
        static ModuleMap _moduleMap;
    };

    FireboltAccessorImpl::ModuleMap FireboltAccessorImpl::_moduleMap;

    FireboltAccessorImpl* FireboltAccessorImpl::_singleton = nullptr;

    /* static */ IFireboltAccessor& IFireboltAccessor::Instance()
    {
         return (FireboltAccessorImpl::Instance());
    }
    /* static */ void IFireboltAccessor::Dispose()
    {
         FireboltAccessorImpl::Dispose();
    }
}
