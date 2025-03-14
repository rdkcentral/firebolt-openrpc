#pragma once
#include "TypesPriv.h"

namespace Firebolt
{

    namespace Advertising
    {
        class JsonData_AdPolicy;
    }
    namespace Accessibility
    {
        class JsonData_AudioDescriptionSettings;
        class JsonData_ClosedCaptionsSettings;
        class JsonData_VoiceGuidanceSettings;
    }

    namespace Device
    {
        class JsonData_AudioProfiles;
        class JsonData_HDCPVersionMap;
        class JsonData_HDRFormatMap;
        class JsonData_NetworkInfoResult;
        class JsonData_Resolution;
    }

    namespace Discovery
    {
        class JsonData_DiscoveryPolicy;
    }
}

class IProperties
{
public:
    virtual ~IProperties() = default;
    virtual Firebolt::Error Get(const std::string &propertyName, FireboltSDK::JSON::String &response) = 0;

    virtual Firebolt::Error Get(const std::string &propertyName, WPEFramework::Core::JSON::ArrayType<FireboltSDK::JSON::String> &response) = 0;

    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Advertising::JsonData_AdPolicy &response) = 0;

    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Accessibility::JsonData_AudioDescriptionSettings &response) = 0;
    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Accessibility::JsonData_ClosedCaptionsSettings &response) = 0;
    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Accessibility::JsonData_VoiceGuidanceSettings &response) = 0;

    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_AudioProfiles &response) = 0;
    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_HDCPVersionMap &response) = 0;
    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_HDRFormatMap &response) = 0;
    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_NetworkInfoResult &response) = 0;
    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_Resolution &response) = 0;

    virtual Firebolt::Error Get(const std::string &propertyName, Firebolt::Discovery::JsonData_DiscoveryPolicy &response) = 0;
};