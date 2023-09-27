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

#include <firebolt.h>
#include "FireboltSDK.h"

namespace Firebolt {

    class FireboltAccessorImpl :: public IFireboltAccessor {
    private:
        FireboltAccessorImpl()
        {
            ASSERT(_singleton == nullptr);
            _singleton = this;
        }
    public:
        FireboltAccessorImpl(const FireboltAccessorImpl&) = delete;
        FireboltAccessorImpl& operator=(const FireboltAccessorImpl&) = delete;

        ~FireboltAccessorImp()
        {
            ASSERT(_singleton != nullptr);
            _singleton = nullptr;
        }

        static FireboltAccessor& Instance()
        {
            static FireboltAccessorImpl* instance = new FireboltAccessorImpl();
            ASSERT(instance != nullptr);
            return *instance;
        }

	static void Dispose()
        {
${module.deinit}
            ASSERT(_singleton != nullptr);
            if (_singleton != nullptr) {
                delete _singleton;
            }
        }

        Firebolt::Error Intitialize( const std::string& configLine ) override
        {
            _accessor = Accessor::Instance();
            return Error::None;
        }

        Firebolt::Error Deinitialize() override
        {
            return Error::None;
        }

        void Connect( OnConnectionChanged listener ) override
        {
            _accessor->Connect(listener);
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
        Accessor& _accessor;
        static FireboltAccessorImpl* _singleton;
    };

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
