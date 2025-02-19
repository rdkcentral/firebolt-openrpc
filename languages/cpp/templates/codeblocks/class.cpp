#ifdef GATEWAY_BIDIRECTIONAL
    static void ProviderInvokeSession(unsigned id, std::string& methodName, JsonObject& jsonParameters, Fir>
    {
        Firebolt::Error status = Firebolt::Error::NotConnected;

        status = FireboltSDK::Gateway::Instance().Response(id, methodName, jsonParameters);
        if (status == Firebolt::Error::None) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltS>
        }

        if (err != nullptr) {
            *err = status;
        }
    }
#endif

    static void ProviderFocusSession(std::string methodName, std::string& correlationId, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;

#ifdef GATEWAY_BIDIRECTIONAL
#else
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);
#endif

        ProviderInvokeSession(methodName, jsonParameters, err);
    }
    static void ProviderResultSession(std::string methodName, std::string& correlationId, ${provider.xresponse.name} result, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;

${provider.xresponse.serialization}
#ifdef GATEWAY_BIDIRECTIONAL
        ProviderInvokeSession(std::stoul(correlationId), methodName, jsonParameters, err);
#else
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

        ProviderInvokeSession(methodName, jsonParameters, err);
#endif
    }
    static void ProviderErrorSession(std::string methodName, std::string& correlationId, ${provider.xerror.name} result, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;

${provider.xerror.serialization}
#ifdef GATEWAY_BIDIRECTIONAL
        ProviderInvokeSession(std::stoul(correlationId), methodName, jsonParameters, err);
#else
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

        ProviderInvokeSession(methodName, jsonParameters, err);
#endif
    }
  

${methods}
