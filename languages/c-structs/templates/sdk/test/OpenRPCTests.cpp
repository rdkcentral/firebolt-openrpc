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
#include "OpenRPCCTests.h"

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
namespace FireboltSDK {
    Tests::Tests()
    {
        _functionMap.emplace(std::piecewise_construct, std::forward_as_tuple("SubscribeEventWithMultipleCallback"),
                             std::forward_as_tuple(&SubscribeEventWithMultipleCallback));
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

    /* static */ uint32_t Tests::GetDeviceId()
    {
        const string method = _T("device.id");
        WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String> response;
        uint32_t status = FireboltSDK::Properties::Get(method, response);

        EXPECT_EQ(status, FireboltSDKErrorNone);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(), "DeviceId : %s", response->Value().c_str());
        } else {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Get %s status = %d\n", method.c_str(), status);
        }

        return status;
    }

    /*static */ uint32_t Tests::GetDeviceVersion()
    {
        const string method = _T("device.version");
        WPEFramework::Core::ProxyType<JsonObject> response;
        uint32_t status = FireboltSDK::Properties::Get(method, response);

        EXPECT_EQ(status, FireboltSDKErrorNone);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(), "DeviceVersion");
            PrintJsonObject(response->Variants());
        } else {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Get %s status = %d", method.c_str(), status);
        }

        return status;
    }

    /* static */ uint32_t Tests::GetUnKnownMethod()
    {
        const string method = _T("get.unknownMethod");
        WPEFramework::Core::ProxyType<JsonObject> response;
        uint32_t status = FireboltSDK::Properties::Get(method, response);

        EXPECT_NE(status, FireboltSDKErrorNone);
        if (status != FireboltSDKErrorNone) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Get %s status = %d\n", method.c_str(), status);
        }

        return status;
    }

    /* static */ uint32_t Tests::SetLifeCycleClose()
    {
        const string method = _T("lifecycle.close");
        JsonObject parameters;
        parameters["reason"] = "remoteButton";
        uint32_t status = FireboltSDK::Properties::Set(method, parameters);

        EXPECT_EQ(status, FireboltSDKErrorNone);
        if (status != FireboltSDKErrorNone) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Set %s status = %d\n", method.c_str(), status);
        }

        return status;
    }

    /* static */ uint32_t Tests::SetUnKnownMethod()
    {
        const string method = _T("set.unknownMethod");
        JsonObject parameters;
        uint32_t status = FireboltSDK::Properties::Set(method, parameters);

        EXPECT_NE(status, FireboltSDKErrorNone);
        if (status != FireboltSDKErrorNone) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Set %s status = %d", method.c_str(), status);
        }

        return status;
    }

    static void deviceNameChangeCallback(const void* userData, void* response)
    {
        WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>& jsonResponse = *(static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>*>(response));
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Received a new event: %s", jsonResponse->Value().c_str());
        jsonResponse.Release();
        FireboltSDK::Tests::EventControl* eventControl = reinterpret_cast<FireboltSDK::Tests::EventControl*>(const_cast<void*>(userData));
        eventControl->NotifyEvent();
    }

    /* static */ uint32_t Tests::SubscribeEvent()
    {
        FireboltSDK::Tests::EventControl* eventControl = new FireboltSDK::Tests::EventControl();
        const string eventName = _T("device.Name");
        const void* userdata = static_cast<void*>(eventControl);

        uint32_t id = 0;

        eventControl->ResetEvent();
        uint32_t status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, deviceNameChangeCallback, userdata, id);

        EXPECT_EQ(status, FireboltSDKErrorNone);
        if (status != FireboltSDKErrorNone) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "Set %s status = %d", eventName.c_str(), status);
        } else {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "%s Yes registered successfully", __func__);
            eventControl->WaitForEvent(WPEFramework::Core::infinite);
        }

        EXPECT_EQ(Properties::Unsubscribe(eventName, id), FireboltSDKErrorNone);
        delete eventControl;

        return status;
    }

    template <typename CALLBACK>
    /* static */ uint32_t Tests::SubscribeEventForC(const string& eventName, CALLBACK& callbackFunc, const void* userdata, uint32_t& id)
    {
        return Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, callbackFunc, userdata, id);;
    }

    static void deviceNameChangeMultipleCallback(const void* userData, void* response)
    {
        WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>& jsonResponse = *(static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>*>(response));
        FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
        "Received a new event from deviceNameChangeMultipleCallback: %s", jsonResponse->Value().c_str());
        jsonResponse.Release();
        FireboltSDK::Tests::EventControl* eventControl = reinterpret_cast<FireboltSDK::Tests::EventControl*>(const_cast<void*>(userData));
        eventControl->NotifyEvent();
    }

    /* static */ uint32_t Tests::SubscribeEventWithMultipleCallback()
    {
        FireboltSDK::Tests::EventControl* eventControl1 = new FireboltSDK::Tests::EventControl();
        const string eventName = _T("device.Name");
        const void* userdata = static_cast<void*>(eventControl1);
        uint32_t id1 = 0, id2 = 0;

        eventControl1->ResetEvent();
        uint32_t status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, deviceNameChangeCallback, userdata, id1);

        EXPECT_EQ(status, FireboltSDKErrorNone);
        if (status != FireboltSDKErrorNone) {
            FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "Set %s status = %d", eventName.c_str(), status);
        } else {
            FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
            "%s Yes registered successfully", __func__);
        }

        if (status == FireboltSDKErrorNone) {
            FireboltSDK::Tests::EventControl* eventControl2 = new FireboltSDK::Tests::EventControl();
            userdata = static_cast<void*>(eventControl2);

            status = Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, deviceNameChangeMultipleCallback, userdata, id2);

            EXPECT_EQ(status, FireboltSDKErrorNone);
            if (status != FireboltSDKErrorNone) {
                FIREBOLT_LOG_ERROR(Logger::Category::OpenRPC, Logger::Module<Tests>(), "Set %s status = %d", eventName.c_str(), status);
            } else {
                FIREBOLT_LOG_INFO(Logger::Category::OpenRPC, Logger::Module<Tests>(),
                "%s Yes registered second callback also successfully", __func__);
                eventControl1->WaitForEvent(WPEFramework::Core::infinite);
                eventControl2->WaitForEvent(WPEFramework::Core::infinite);
            }
            EXPECT_EQ(Properties::Unsubscribe(eventName, id1), FireboltSDKErrorNone);
            delete eventControl2;
        }
        EXPECT_EQ(Properties::Unsubscribe(eventName, id2), FireboltSDKErrorNone);

        delete eventControl1;
        return status;
    }

}

#ifdef __cplusplus
extern "C" {
#endif

uint32_t test_firebolt_create_instance()
{
    FireboltSDK::Accessor::Instance();
}

uint32_t test_firebolt_dispose_instance()
{
    FireboltSDK::Accessor::Dispose();
}

uint32_t test_firebolt_main()
{
    return FireboltSDK::Tests::Main<FireboltSDK::Tests>();
}

uint32_t test_properties_get_device_id()
{
    const string method = _T("device.id");
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String> response;
    uint32_t status = FireboltSDK::Properties::Get(method, response);

    EXPECT_EQ(status, FireboltSDKErrorNone);
    if (status == FireboltSDKErrorNone) {
        FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "DeviceId : %s", response->Value().c_str());
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "Get %s status = %d", method.c_str(), status);
    }

    return status;
}

uint32_t test_properties_set()
{
    const string method = _T("lifecycle.close");
    JsonObject parameters;
    parameters["reason"] = "remoteButton";
    uint32_t status = FireboltSDK::Properties::Set(method, parameters);

    EXPECT_EQ(status, FireboltSDKErrorNone);
    if (status != FireboltSDKErrorNone) {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "Set %s status = %d", method.c_str(), status);
    }

    return status;
}

static void deviceNameChangeCallbackForC(const void* userData, void* response)
{
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>& jsonResponse = *(static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::String>*>(response));
    FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, "ctest",
    "Received a new event--->: %s", jsonResponse->Value().c_str());
    jsonResponse.Release();

    FireboltSDK::Tests::EventControl* eventControl = reinterpret_cast<FireboltSDK::Tests::EventControl*>(const_cast<void*>(userData));
    eventControl->NotifyEvent();
}

uint32_t test_eventregister()
{
    FireboltSDK::Tests::EventControl* eventControl = new FireboltSDK::Tests::EventControl();
    JsonObject parameters;

    const string eventName = _T("device.Name");
    const void* userdata = static_cast<void*>(eventControl);
    uint32_t id = 0;

    eventControl->ResetEvent();
    uint32_t status = FireboltSDK::Properties::Subscribe<WPEFramework::Core::JSON::String>(eventName, deviceNameChangeCallbackForC, userdata, id);

    EXPECT_EQ(status, FireboltSDKErrorNone);
    if (status != FireboltSDKErrorNone) {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "%s Set %s status = %d", __func__, eventName.c_str(), status);
    } else {
        FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "%s Yes registered successfully", __func__);
        eventControl->WaitForEvent(WPEFramework::Core::infinite);
    }

    delete eventControl;
    EXPECT_EQ(FireboltSDK::Properties::Unsubscribe(eventName, id), FireboltSDKErrorNone);

    return status;
}

uint32_t test_eventregister_by_providing_callback()
{
    FireboltSDK::Tests::EventControl* eventControl = new FireboltSDK::Tests::EventControl();

    const string eventName = _T("device.Name");
    const void* userdata = static_cast<void*>(eventControl);
    uint32_t id = 0;

    eventControl->ResetEvent();
    uint32_t status = FireboltSDK::Tests::SubscribeEventForC(eventName, deviceNameChangeCallbackForC, userdata, id);

    EXPECT_EQ(status, FireboltSDKErrorNone);
    if (status != FireboltSDKErrorNone) {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "%s Set %s status = %d", __func__, eventName.c_str(), status);
    } else {
        FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, "ctest",
        "%s Yes registered successfully", __func__);
        eventControl->WaitForEvent(WPEFramework::Core::infinite);
    }

    delete eventControl;
    EXPECT_EQ(FireboltSDK::Properties::Unsubscribe(eventName, id), FireboltSDKErrorNone);
}

#include "TypesPriv.h"
uint32_t test_string_set_get_value()
{
    uint32_t status = FireboltSDKErrorNone;
    FireboltSDK::String* str = new FireboltSDK::String("testString");
    void* handle = static_cast<void*>(str);

    const char* value = FireboltTypes_String(handle);
    EXPECT_EQ(strncmp(value, str->Value().c_str(), str->Value().length()), 0);
    FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, "ctest",
    " ---> type name = %s %s", str->Value().c_str(), value);

    WPEFramework::Core::JSON::EnumType<::TestEnum> testEnum = Test4;
    FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, "ctest",
    " EnumTest = %d %s", testEnum.Value(), testEnum.Data());
    FireboltTypes_StringHandle_Release(handle);
    return status;
}

#ifdef __cplusplus
}
#endif
