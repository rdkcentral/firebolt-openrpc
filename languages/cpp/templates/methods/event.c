        /* ${method.rpc.name} - ${method.description} */
        static void ${info.Title}${method.Name}InnerCallback( void* notification, const void* userData, void* jsonResponse )
        {
${event.callback.params.serialization}
            ASSERT(proxyResponse->IsValid() == true);
            if (proxyResponse->IsValid() == true) {
${event.callback.result.instantiation}
                proxyResponse->Release();

                I${method.Name}Notification& notifier = *(reinterpret_cast<I${method.Name}Notification*>(notification);
                notifier.${method.Name}(${event.callback.response.instantiation});
            }
        }
        void Subscribe( ${event.signature.params}${if.event.params}, ${end.if.event.params}I${method.Name}Notification& notification, Firebolt_Error *err = nullptr )
        {
            const string eventName = _T("${info.title.lowercase}.${method.rpc.name}");
            int32_t status = Firebolt_Error_None;

            if (notification != nullptr) {
${event.params.serialization}
               status = FireboltSDK::Event::Instance().Subscribe<${event.result.json.type}>(eventName, jsonParameters, ${info.Title}${method.Name}InnerCallback, reinterpret_cast<void*>(notification), nullptr);
            }
        }
        void Unsubscribe( I${method.Name}Notification& notification, Firebolt_Error *err = nullptr )
        {
            int32_t status = FireboltSDK::Event::Instance().Unsubscribe(_T("${info.title.lowercase}.${method.rpc.name}"), reinterpret_cast<void*>(notification));
        }

