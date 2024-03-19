
    /* ${method.name}AsyncResponseInnerCallback */
    static void ${method.name}AsyncResponseInnerCallback(void* notification, void* jsonResponse, Firebolt::Error status)
    {
        WPEFramework::Core::ProxyType<${method.result.json.type}>& proxyResponse = *(reinterpret_cast<WPEFramework::Core::ProxyType<${method.result.json.type}>*>(jsonResponse));

        ASSERT(proxyResponse.IsValid() == true);

        if (proxyResponse.IsValid() == true) {

    ${if.result.nonvoid}${method.result.initialization}${end.if.result.nonvoid}
            ${method.result.json.type} jsonResult(proxyResponse->Value().c_str());
${if.result.nonvoid}${method.result.instantiation}${end.if.result.nonvoid}
            proxyResponse.Release();

            I${info.Title}AsyncResponse& notifier = *(reinterpret_cast<I${info.Title}AsyncResponse*>(notification));
            notifier.response(${method.result.name}, &status);
        }
    }

    /* ${method.name} - ${method.description} */
    void ${info.Title}Impl::request${method.Name}(${method.signature.params}${if.params}, ${end.if.params}I${info.Title}AsyncResponse& response, Firebolt::Error *err)
    {
        JsonObject jsonParameters;
${method.params.serialization}

        Firebolt::Error status = FireboltSDK::Async::Instance().Invoke<${method.result.json.type}>(_T("${info.title.lowercase}.${method.name}"), jsonParameters, ${method.name}AsyncResponseInnerCallback, reinterpret_cast<void*>(&response));
        if (status == Firebolt::Error::None) {
                FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.name} is successfully invoked");
        } else {
            FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Async::Invoke err = %d", status);
        }

        if (err != nullptr) {
            *err = status;
        }
        return;
    }
    void ${info.Title}Impl::abort${method.Name}(I${info.Title}AsyncResponse& response, Firebolt::Error *err)
    {
        Firebolt::Error status = FireboltSDK::Async::Instance().Abort(_T("${info.title.lowercase}.${method.name}"), reinterpret_cast<void*>(&response));
	if (err != nullptr) {
            *err = status;
        }
    }
