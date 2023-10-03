
        /* ${method.rpc.name} - ${method.description} */
        void ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err = nullptr )
        {
            const string method = _T("${info.title.lowercase}.${method.rpc.name}");

            JsonObject jsonParameters;
${if.params}${method.params.serialization}${end.if.params}

            Firebolt::Error status = FireboltSDK::Properties::Set(method, jsonParameters);
            if (status != Firebolt::Error::None) {
                err = new Firebolt::Error();
                *err = status;
            }

            return;
        }
