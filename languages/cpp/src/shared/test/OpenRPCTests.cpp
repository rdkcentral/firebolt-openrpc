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

#include "Module.h"
#include "OpenRPCTests.h"

namespace WPEFramework {

ENUM_CONVERSION_BEGIN(::JsonValue::type)

    { JsonValue::type::EMPTY, _TXT("empty") },
    { JsonValue::type::BOOLEAN, _TXT("boolean") },
    { JsonValue::type::NUMBER, _TXT("number") },
    { JsonValue::type::STRING, _TXT("string") },

ENUM_CONVERSION_END(::JsonValue::type)

ENUM_CONVERSION_BEGIN(TestEnum)
    { TestEnum::Test1, _TXT("Test1ValueCheck") },
    { TestEnum::Test2, _TXT("Test2ValueCheck") },
    { TestEnum::Test3, _TXT("Test3ValueCheck") },
    { TestEnum::Test4, _TXT("Test4ValueCheck") },
ENUM_CONVERSION_END(TestEnum)
}

typedef void (*OnNotifyDeviceNameChanged)(const void* userData, const char* data);
static void NotifyEvent(const void* userData, const char* data)
{
    printf("NotifyEvent data : %s\n", data);
}

namespace FireboltSDK {
    Tests::Tests()
    {
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("SubscribeEventWithMultipleCallback"),
                             std::forward_as_tuple(&SubscribeEventWithMultipleCallback));
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("SubscribeEventwithSameCallback"),
                             std::forward_as_tuple(&SubscribeEventwithSameCallback));
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("SubscribeEvent"),
                             std::forward_as_tuple(&SubscribeEvent));

        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("Set UnKnown Method"),
                             std::forward_as_tuple(&SetUnKnownMethod));
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("Set LifeCycle Close"),
                             std::forward_as_tuple(&SetLifeCycleClose));

        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("Get UnKnown Method"),
                             std::forward_as_tuple(&GetUnKnownMethod));
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("Get Device Version"),
                             std::forward_as_tuple(&GetDeviceVersion));
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("Get Device Id"),
                             std::forward_as_tuple(&GetDeviceId));
    }

    /* static */ void Tests::PrintJsonObject(const JsonObject::Iterator& iterator)
    {
        JsonObject::Iterator index = iterator;
        while (index.Next() == true) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "Element [%s]: <%s> = \"%s\"\n",
            index.Label(),
            WPEFramework::Core::EnumerateType<JsonValue::type>(index.Current().Content()).Data(),
            index.Current().Value().c_str());
        }
    }

    /* static */ Firebolt::Error Tests::GetDeviceId()
    {
        const string method = _T("device.id");
        WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String> response;
        Firebolt::Error status = FireboltSDK::Properties::Get(method, response);

        EXPECT_EQ(status, Firebolt::Error::None);
        if (status == Firebolt::Error::None) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(), "DeviceId : %s", response->Value().c_str());
        } else {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Get %s status = %d\n", method.c_str(), status);
        }

        return status;
    }

    /*static */ Firebolt::Error Tests::GetDeviceVersion()
    {
        const string method = _T("device.version");
        WPEFramework::Core::ProxyType<JsonObject> response;
        Firebolt::Error status = FireboltSDK::Properties::Get(method, response);

        EXPECT_EQ(status, Firebolt::Error::None);
        if (status == Firebolt::Error::None) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(), "DeviceVersion");
            PrintJsonObject(response->Variants());
        } else {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Get %s status = %d", method.c_str(), status);
        }

        return status;
    }

    /* static */ Firebolt::Error Tests::GetUnKnownMethod()
    {
        const string method = _T("get.unknownMethod");
        WPEFramework::Core::ProxyType<JsonObject> response;
        Firebolt::Error status = FireboltSDK::Properties::Get(method, response);

        EXPECT_NE(status, Firebolt::Error::None);
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Get %s status = %d\n", method.c_str(), status);
        }

        return status;
    }

    /* static */ Firebolt::Error Tests::SetLifeCycleClose()
    {
        const string method = _T("lifecycle.close");
        JsonObject parameters;
        parameters["reason"] = "remoteButton";
        Firebolt::Error status = FireboltSDK::Properties::Set(method, parameters);

        EXPECT_EQ(status, Firebolt::Error::None);
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Set %s status = %d\n", method.c_str(), status);
        }

        return status;
    }

    /* static */ Firebolt::Error Tests::SetUnKnownMethod()
    {
        const string method = _T("set.unknownMethod");
        JsonObject parameters;
        Firebolt::Error status = FireboltSDK::Properties::Set(method, parameters);

        EXPECT_NE(status, Firebolt::Error::None);
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Set %s status = %d", method.c_str(), status);
        }

        return status;
    }

    static void deviceNameChangeCallback(void* userCB, const void* userData, void* response)
    {
        WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>& jsonResponse = *(reinterpret_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>*>(response));
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Received a new event: %s", jsonResponse->Value().c_str());
        FireboltSDK::Tests::EventControl* eventControl = reinterpret_cast<FireboltSDK::Tests::EventControl*>(const_cast<void*>(userData));
        OnNotifyDeviceNameChanged notifyDeviceNameChanged = reinterpret_cast<OnNotifyDeviceNameChanged>(userCB);
        notifyDeviceNameChanged(userData, jsonResponse->Value().c_str());
        eventControl->NotifyEvent();
        jsonResponse.Release();
    }

    /* static */ Firebolt::Error Tests::SubscribeEvent()
    {
        FireboltSDK::Tests::EventControl* eventControl = new FireboltSDK::Tests::EventControl("EventControl");
        const string eventName = _T("device.Name");
        const void* userdata = static_cast<void*>(eventControl);

        eventControl->ResetEvent();

        JsonObject jsonParameters;
        Firebolt::Error status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, deviceNameChangeCallback,reinterpret_cast<void*>(NotifyEvent), userdata);

        EXPECT_EQ(status, Firebolt::Error::None);
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "Set %s status = %d", eventName.c_str(), status);
        } else {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "%s Yes registered successfully, Waiting for event...", __func__);

            eventControl->WaitForEvent(WPEFramework::Core::infinite);
        }

        EXPECT_EQ(Properties::Unsubscribe(eventName, reinterpret_cast<void*>(NotifyEvent)), Firebolt::Error::None);
        delete eventControl;

        return status;
    }

    /* static */ Firebolt::Error Tests::SubscribeEventwithSameCallback()
    {
        FireboltSDK::Tests::EventControl* eventControl = new FireboltSDK::Tests::EventControl("EventControl");
        const string eventName = _T("device.Name");
        const void* userdata = static_cast<void*>(eventControl);

        eventControl->ResetEvent();

        JsonObject jsonParameters;
        Firebolt::Error status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, deviceNameChangeCallback,reinterpret_cast<void*>(NotifyEvent), userdata);

        EXPECT_EQ(status, Firebolt::Error::None);
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "Set %s status = %d", eventName.c_str(), status);
        } else {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "%s Yes registered successfully", __func__);

            status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, deviceNameChangeCallback, reinterpret_cast<void*>(NotifyEvent), userdata);
            EXPECT_EQ(status, Firebolt::Error::General);
            if (status == Firebolt::Error::General) {
                FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
                "%s Yes this device.name event is already registered with same callback", __func__);
            }
            status = ((status == Firebolt::Error::General) ? Firebolt::Error::None : status);
        }

        EXPECT_EQ(Properties::Unsubscribe(eventName, reinterpret_cast<void*>(NotifyEvent)), Firebolt::Error::None);
        delete eventControl;

        return status;
    }


    static void NotifyEvent1(const void* userData, const char* data)
    {
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
        "NotifyEvent1 data : %s", data);
        if (userData) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "NotifyEvent1 userData : %s\n", reinterpret_cast<const FireboltSDK::Tests::EventControl*>(userData)->Name().c_str());
        }
    }
    static void NotifyEvent2(const void* userData, const char* data)
    {
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
        "NotifyEvent2 data : %s", data);
        if (userData) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "NotifyEvent2 userData : %s\n", reinterpret_cast<const FireboltSDK::Tests::EventControl*>(userData)->Name().c_str());
        }
    }

    template <typename CALLBACK>
    /* static */ Firebolt::Error Tests::SubscribeEventForC(const string& eventName, JsonObject& jsonParameters, CALLBACK& callbackFunc, void* usercb, const void* userdata)
    {
        return Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, callbackFunc, usercb, userdata);
    }

    static void deviceNameChangeMultipleCallback(void* userCB, const void* userData, void* response)
    {
        WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>& jsonResponse = *(reinterpret_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>*>(response));
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
        "Received a new event from deviceNameChangeMultipleCallback: %s", jsonResponse->Value().c_str());
        FireboltSDK::Tests::EventControl* eventControl = reinterpret_cast<FireboltSDK::Tests::EventControl*>(const_cast<void*>(userData));
        OnNotifyDeviceNameChanged notifyDeviceNameChanged = reinterpret_cast<OnNotifyDeviceNameChanged>(userCB);
        notifyDeviceNameChanged(userData, jsonResponse->Value().c_str());

        eventControl->NotifyEvent();
        jsonResponse.Release();
    }

    /* static */ Firebolt::Error Tests::SubscribeEventWithMultipleCallback()
    {
        FireboltSDK::Tests::EventControl* eventControl1 = new FireboltSDK::Tests::EventControl("EventControl1");
        const string eventName = _T("device.Name");
        const void* userdata = static_cast<void*>(eventControl1);

        eventControl1->ResetEvent();

        JsonObject jsonParameters;
        Firebolt::Error status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, deviceNameChangeMultipleCallback, reinterpret_cast<void*>(NotifyEvent1), userdata);

        EXPECT_EQ(status, Firebolt::Error::None);
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "Set %s status = %d", eventName.c_str(), status);
        } else {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "%s Yes registered successfully, Waiting for event...", __func__);
        }

        if (status == Firebolt::Error::None) {
            FireboltSDK::Tests::EventControl* eventControl2 = new FireboltSDK::Tests::EventControl("EventControl2");
            userdata = static_cast<void*>(eventControl2);

            status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, deviceNameChangeMultipleCallback, reinterpret_cast<void*>(NotifyEvent2), userdata);

            EXPECT_EQ(status, Firebolt::Error::None);
            if (status != Firebolt::Error::None) {
                FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Set %s status = %d", eventName.c_str(), status);
            } else {
                status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, jsonParameters, deviceNameChangeMultipleCallback, reinterpret_cast<void*>(NotifyEvent2), userdata);
                EXPECT_EQ(status, Firebolt::Error::General);
                status = ((status == Firebolt::Error::General) ? Firebolt::Error::None : status);

                FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
                "%s Yes registered second callback also successfully, waiting for events...\n", __func__);

                eventControl1->WaitForEvent(WPEFramework::Core::infinite);
                eventControl2->WaitForEvent(WPEFramework::Core::infinite);
            }
            EXPECT_EQ(Properties::Unsubscribe(eventName, reinterpret_cast<void*>(NotifyEvent2)), Firebolt::Error::None);
            delete eventControl2;
        }
        EXPECT_EQ(Properties::Unsubscribe(eventName, reinterpret_cast<void*>(NotifyEvent1)), Firebolt::Error::None);

        delete eventControl1;
        return status;
    }

}
