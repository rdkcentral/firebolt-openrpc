        eventName = _T("${info.title.lowercase}.onRequest${method.Name}");
#ifdef GATEWAY_BIDIRECTIONAL
        status = FireboltSDK::Gateway::Instance().RegisterProviderInterface<${event.result.json.type}>(eventName, jsonParameters, ${info.Title}${method.Name}SessionInnerCallback, reinterpret_cast<void*>(&provider));
#else
        status = FireboltSDK::Event::Instance().Subscribe<${event.result.json.type}>(eventName, jsonParameters, ${info.Title}${method.Name}SessionInnerCallback, reinterpret_cast<void*>(&provider), nullptr);
#endif
        if (status != Firebolt::Error::None) {
            FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in %s subscribe = %d", eventName.c_str(), status);
        }
