    static void ProviderInvokeSession(std::string& methodName, JsonObject& jsonParameters, Firebolt::Error *err = nullptr)
    {
        Firebolt::Error status = Firebolt::Error::NotConnected;
        FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
        if (transport != nullptr) {

            JsonObject jsonResult;
            status = transport->Invoke(methodName, jsonParameters, jsonResult);
            if (status == Firebolt::Error::None) {
                FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "%s is successfully invoked", methodName.c_str());
            }

        } else {
            FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
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
    static void ProviderResultSession(std::string methodName, std::string& correlationId, ${if.result.namespace.notsame}${parent.Title}::${end.if.result.namespace.notsame}${provider.xresponse.name} result, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

${provider.xresponse.serialization}
        ProviderInvokeSession(methodName, jsonParameters, err);
    }
    static void ProviderErrorSession(std::string methodName, std::string& correlationId, ${if.error.namespace.notsame}${parent.Title}::${end.if.error.namespace.notsame}${provider.xerror.name} result, Firebolt::Error *err = nullptr)
    {
        JsonObject jsonParameters;
        WPEFramework::Core::JSON::Variant CorrelationId(correlationId);
        jsonParameters.Set(_T("correlationId"), CorrelationId);

${provider.xerror.serialization}
        ProviderInvokeSession(methodName, jsonParameters, err);
    }
  
${methods}
