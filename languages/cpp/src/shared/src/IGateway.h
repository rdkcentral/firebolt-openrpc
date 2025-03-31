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
#include "TypesPriv.h"
#include "error.h"

namespace Firebolt
{
    namespace Authentication
    {
        class JsonData_Token;
    }
}

namespace Firebolt
{
    namespace Advertising
    {
        class JsonData_AdPolicy;
        class JsonData_AdvertisingId;
        class JsonData_AdFrameworkConfig : public WPEFramework::Core::JSON::VariantContainer
        {
        };
        class JsonData_DeviceAttributes : public WPEFramework::Core::JSON::VariantContainer
        {
        };
    }

    namespace Accessibility
    {
        class JsonData_ClosedCaptionsSettings;
        class JsonData_VoiceGuidanceSettings;
        class JsonData_AudioDescriptionSettings;
    }

    namespace Capabilities
    {
        class JsonData_CapabilityInfo;
    }

    namespace Device
    {
        class JsonData_AudioProfiles;
        class JsonData_HDCPVersionMap;
        class JsonData_HDRFormatMap;
        class JsonData_NetworkInfoResult;
        class JsonData_Resolution;
        class JsonData_DeviceVersion;
    }

    namespace Discovery
    {
        class JsonData_DiscoveryPolicy;
    }

    namespace Localization
    {
        class JsonData_Info : public WPEFramework::Core::JSON::VariantContainer
        {
        };
        class JsonData_LatLon : public WPEFramework::Core::JSON::ArrayType<WPEFramework::Core::JSON::Float>
        {
        };
    }

    namespace Parameters
    {
        class JsonData_AppInitialization;
    }

    namespace Types
    {
        class JsonData_FlatMap : public WPEFramework::Core::JSON::VariantContainer
        {
        };
        class JsonData_BooleanMap : public WPEFramework::Core::JSON::VariantContainer
        {
        };
    }

}

class IGateway
{
public:
    virtual ~IGateway() = default;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, FireboltSDK::JSON::String &result) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, WPEFramework::Core::JSON::VariantContainer &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, WPEFramework::Core::JSON::Boolean &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Authentication::JsonData_Token &result) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Advertising::JsonData_AdPolicy &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Advertising::JsonData_AdvertisingId &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Advertising::JsonData_AdFrameworkConfig &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Advertising::JsonData_DeviceAttributes &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Accessibility::JsonData_ClosedCaptionsSettings &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Accessibility::JsonData_VoiceGuidanceSettings &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Accessibility::JsonData_AudioDescriptionSettings &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Device::JsonData_DeviceVersion &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Device::JsonData_AudioProfiles &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Device::JsonData_HDCPVersionMap &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Device::JsonData_HDRFormatMap &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Device::JsonData_NetworkInfoResult &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Device::JsonData_Resolution &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, WPEFramework::Core::JSON::ArrayType<Firebolt::Capabilities::JsonData_CapabilityInfo> &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Discovery::JsonData_DiscoveryPolicy &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Localization::JsonData_Info &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Localization::JsonData_LatLon &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Parameters::JsonData_AppInitialization &response) = 0;

    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Types::JsonData_FlatMap &response) = 0;
    virtual Firebolt::Error Request(const std::string &method, const JsonObject &parameters, Firebolt::Types::JsonData_BooleanMap &response) = 0;
};
