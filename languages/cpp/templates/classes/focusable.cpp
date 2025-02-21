    static std::string ${info.Title}${method.Name}SessionInnerCallback( void* provider, void* jsonRequest )
    {
        WPEFramework::Core::ProxyType<JsonData_${info.Title}ProviderRequest>& proxyRequest = *(reinterpret_cast<WPEFramework::Core::ProxyType<JsonData_${info.Title}ProviderRequest>*>(jsonRequest));

        ASSERT(proxyRequest.IsValid() == true);

        if (!proxyRequest.IsValid()) {
            return R"({"error": { "code": )" + std::to_string(static_cast<int32_t>(Firebolt::Error::InvalidParams)) + R"(, "message": "Invalid Parameters"}, "result": ""})";
        }
        std::string requestMessage = (*proxyRequest).Parameters.Message;

        proxyRequest.Release();

        I${info.Title}Provider& ${info.title.lowercase}Provider = *(reinterpret_cast<I${info.Title}Provider*>(provider));
        std::string result = ${info.title.lowercase}Provider.${method.name}(requestMessage.parameters);
        return "{\"result\":\"" + result + "\"}";
    }

