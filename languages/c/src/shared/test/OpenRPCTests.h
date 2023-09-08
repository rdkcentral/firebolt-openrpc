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

#include "FireboltSDK.h"
#include "TestUtils.h"

typedef enum {
    Test1,
    Test2,
    Test3,
    Test4
} TestEnum;

namespace FireboltSDK {
    typedef int32_t (*Func)();

    class Tests {
    public:
        class EventControl {
        public:
            EventControl()
               : _event(false, true)
               , _name("EventControl")
            {
            }
            EventControl(string name)
               : _event(false, true)
               , _name(name)
            {
            }
            ~EventControl() = default;

        public:
            void NotifyEvent()
            {
                _event.SetEvent();
            }
            uint32_t WaitForEvent(uint32_t waitTime)
            {
                return _event.Lock(waitTime);
            }
            void ResetEvent()
            {
                _event.ResetEvent();
            }
            string Name() const
            {
                return _name;
            }
        private:
            WPEFramework::Core::Event _event;
            string _name;
        };

    private:
        typedef std::unordered_map<std::string, Func> TestFunctionMap;

    public:
        Tests();
        virtual ~Tests() = default;

        inline TestFunctionMap& TestList()
        {
            return _functionMap;
        }

        template<typename TESTS>
        static int32_t Main()
        {
            TESTS fireboltTest;
            for (auto i = fireboltTest.TestList().begin(); i != fireboltTest.TestList().end(); i++) {
                EXECUTE(i->first.c_str(), i->second);
            }

            printf("TOTAL: %i tests; %i PASSED, %i FAILED\n", TotalTests, TotalTestsPassed, (TotalTests - TotalTestsPassed));

            return 0;
        }

        static int32_t GetDeviceId();
        static int32_t GetDeviceVersion();
        static int32_t GetUnKnownMethod();

        static int32_t SetLifeCycleClose();
        static int32_t SetUnKnownMethod();

        static int32_t SubscribeEvent();
        static int32_t SubscribeEventwithSameCallback();
        static int32_t SubscribeEventWithMultipleCallback();

        template <typename CALLBACK>
        static int32_t SubscribeEventForC(const string& eventName, JsonObject& jsonParameters, CALLBACK& callbackFunc, void* usercb, const void* userdata);

    protected:
        static void PrintJsonObject(const JsonObject::Iterator& iterator);

    protected:
        std::list<string> menu;
        TestFunctionMap _functionMap;
    };
}
