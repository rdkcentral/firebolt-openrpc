
    /* ${method.name} - ${method.description} */
    void ${info.Title}Impl::${method.name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err )
    {
        const string method = _T("${info.title.lowercase}.${method.name}");

        JsonObject jsonParameters;
${if.params}${method.params.serialization}${end.if.params}

        Firebolt::Error status = FireboltSDK::Properties::Set(method, jsonParameters);
        if (err != nullptr) {
            *err = status;
        }

        return;
    }