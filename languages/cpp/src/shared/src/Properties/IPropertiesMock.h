#pragma once

#include "IProperties.h"

class IPropertiesMock : public IProperties
{
public:
    Firebolt::Error Get(const std::string &propertyName, FireboltSDK::JSON::String &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with FireboltSDK::JSON::String response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Advertising::JsonData_AdPolicy &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Advertising::JsonData_AdPolicy response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Accessibility::JsonData_AudioDescriptionSettings &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Accessibility::JsonData_AudioDescriptionSettings response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Accessibility::JsonData_ClosedCaptionsSettings &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Accessibility::JsonData_ClosedCaptionsSettings response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Accessibility::JsonData_VoiceGuidanceSettings &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Accessibility::JsonData_VoiceGuidanceSettings response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_AudioProfiles &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Device::JsonData_AudioProfiles response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_HDCPVersionMap &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Device::JsonData_HDCPVersionMap response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_HDRFormatMap &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Device::JsonData_HDRFormatMap response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_NetworkInfoResult &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Device::JsonData_NetworkInfoResult response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Device::JsonData_Resolution &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Device::JsonData_Resolution response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, Firebolt::Discovery::JsonData_DiscoveryPolicy &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with Firebolt::Discovery::JsonData_DiscoveryPolicy response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }

    Firebolt::Error Get(const std::string &propertyName, WPEFramework::Core::JSON::ArrayType<FireboltSDK::JSON::String> &response)
    {
        std::cout << "[A] GMock method was not invoked! Instead - Properties::Get() with ArrayType<FireboltSDK::JSON::String> response type was invoked.\n";
        return Firebolt::Error::NotConnected;
    }
};