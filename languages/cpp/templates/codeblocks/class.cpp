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
  
${methods}
