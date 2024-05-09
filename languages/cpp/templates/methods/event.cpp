    /* ${method.name} - ${method.description} */
    static void ${method.name}InnerCallback( void* notification, const void* userData, void* jsonResponse )
    {
${event.callback.serialization}
        ASSERT(proxyResponse.IsValid() == true);

        if (proxyResponse.IsValid() == true) {
${event.callback.initialization}

${event.callback.instantiation}
            proxyResponse.Release();

            I${info.Title}::I${method.Name}Notification& notifier = *(reinterpret_cast<I${info.Title}::I${method.Name}Notification*>(notification));
            notifier.${method.rpc.name}(${event.callback.response.instantiation});
        }
    }
    void ${info.Title}Impl::subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${info.Title}::I${method.Name}Notification& notification, Firebolt::Error *err )
    {
        const string eventName = _T("${info.title.lowercase}.${method.rpc.name}");
        Firebolt::Error status = Firebolt::Error::None;

        JsonObject jsonParameters;
${event.params.serialization}
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
