        /* ${method.rpc.name} - ${method.description} */
        static void ${info.Title}${method.Name}InnerCallback( void* notification, const void* userData, void* jsonResponse )
        {
${event.callback.params.serialization}
            ASSERT(proxyResponse->IsValid() == true);

            if (proxyResponse->IsValid() == true) {
${event.callback.result.instantiation}
                proxyResponse->Release();

                I${method.Name}Notification& notifier = *(reinterpret_cast<I${method.Name}Notification*>(notification));
                notifier.${method.Name}(${event.callback.response.instantiation});
            }
        }
        void Subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${method.Name}Notification& notification, Firebolt::Error *err = nullptr )
        {
            const string eventName = _T("${info.title.lowercase}.${method.rpc.name}");
            Firebolt::Error status = Firebolt::Error::None;

            JsonObject jsonParameters;
${event.params.serialization}
            status = FireboltSDK::Event::Instance().Subscribe<${event.result.json.type}>(eventName, jsonParameters, ${info.Title}${method.Name}InnerCallback, reinterpret_cast<void*>(&notification), nullptr);
        }
        void Unsubscribe( I${method.Name}Notification& notification, Firebolt::Error *err = nullptr )
        {
            Firebolt::Error status = FireboltSDK::Event::Instance().Unsubscribe(_T("${info.title.lowercase}.${method.rpc.name}"), reinterpret_cast<void*>(&notification));
        }
