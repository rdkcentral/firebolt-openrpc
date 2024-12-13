    static void ProviderInvokeSession(std::string& methodName, JsonObject& jsonParameters, Firebolt::Error *err = nullptr)
    {
        Firebolt::Error status = Firebolt::Error::NotConnected;

        JsonObject jsonResult;
        status = FireboltSDK::Gateway::Instance().Request(methodName, jsonParameters, jsonResult);
        if (status == Firebolt::Error::None) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "%s is successfully invoked", methodName.c_str());
        }

        if (err != nullptr) {
            *err = status;
        }
    }
    static void ProviderFocusSession(std::string methodName, std::string& correlationId, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

        ProviderInvokeSession(methodName, jsonParameters, err);
    }
    static void ProviderResultSession(std::string methodName, std::string& correlationId, ${provider.xresponse.name} result, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

${provider.xresponse.serialization}
        ProviderInvokeSession(methodName, jsonParameters, err);
    }
    static void ProviderErrorSession(std::string methodName, std::string& correlationId, ${provider.xerror.name} result, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

${provider.xerror.serialization}
        ProviderInvokeSession(methodName, jsonParameters, err);
    }
  
${methods}
