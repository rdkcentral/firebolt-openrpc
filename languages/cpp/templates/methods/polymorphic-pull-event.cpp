    /* ${method.rpc.name} - ${method.description} */
    static void ${method.name}InnerCallback( void* notification, const void* userData, void* jsonResponse )
    {
${event.callback.serialization}
        ASSERT(proxyResponse.IsValid() == true);

        if (proxyResponse.IsValid() == true) {
            ${method.pulls.param.json.type} jsonResult = proxyResponse->Parameters;
    ${method.pulls.response.initialization}
${method.pulls.response.instantiation}

            I${info.Title}::I${method.Name}Notification& notifier = *(reinterpret_cast<I${info.Title}::I${method.Name}Notification*>(notification));
            ${method.pulls.type} element = notifier.${method.name}(${method.pulls.param.title});
            Firebolt::Error status = Firebolt::Error::NotConnected;
            FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
            if (transport != nullptr) {
                JsonObject jsonParameters;
                WPEFramework::Core::JSON::Variant CorrelationId = proxyResponse->CorrelationId.Value();
                jsonParameters.Set(_T("correlationId"), CorrelationId);
                ${method.pulls.json.type} ${method.pulls.result.title}Container;
                {
        ${method.pulls.result.serialization.with.indent}
                }
                string resultStr;
                ${method.pulls.result.title}Container.ToString(resultStr);
                WPEFramework::Core::JSON::VariantContainer resultContainer(resultStr);
                WPEFramework::Core::JSON::Variant Result = resultContainer;
                jsonParameters.Set(_T("result"), Result);
                WPEFramework::Core::JSON::Boolean jsonResult;

                status = transport->Invoke("${info.title.lowercase}.${method.pulls.for}", jsonParameters, jsonResult);
                if (status == Firebolt::Error::None) {
                    FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.rpc.name} is successfully pushed with status as %d", jsonResult.Value());
                }

            } else {
                FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
            }
            proxyResponse.Release();
        }
    }
    void ${info.Title}Impl::subscribe( I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err )
    {
        const string eventName = _T("${info.title.lowercase}.${method.rpc.name}");
        Firebolt::Error status = Firebolt::Error::None;

        JsonObject jsonParameters;
        status = FireboltSDK::Event::Instance().Subscribe<${event.result.json.type}>(eventName, jsonParameters, ${method.name}InnerCallback, reinterpret_cast<void*>(&notification), nullptr);

        if (err != nullptr) {
            *err = status;
        }
    }
    void ${info.Title}Impl::unsubscribe( I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err )
    {
        Firebolt::Error status = FireboltSDK::Event::Instance().Unsubscribe(_T("${info.title.lowercase}.${method.rpc.name}"), reinterpret_cast<void*>(&notification));

        if (err != nullptr) {
            *err = status;
        }
    }
