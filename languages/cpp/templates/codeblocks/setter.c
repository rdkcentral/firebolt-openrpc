
        /* ${method.rpc.name} - ${method.description} */
        void ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt_Error *err = nullptr )
        {
            const string method = _T("${info.title.lowercase}.${method.rpc.name}");

            JsonObject jsonParameters;
${if.params}${method.params.serialization}${end.if.params}

            int32_t status = FireboltSDK::Properties::Set(method, jsonParameters);
            return;
        }