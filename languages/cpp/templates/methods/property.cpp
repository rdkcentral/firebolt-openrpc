    /* ${method.name} - ${method.description} */
    ${method.signature.result} ${info.Title}Impl::${method.name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err ) const
    {
        const string method = _T("${info.title.lowercase}.${method.name}");
        ${if.params}JsonObject jsonParameters;${end.if.params}
        ${if.params}${method.params.serialization}${end.if.params}
        ${title} jsonResult;
${method.result.initialization}
        ${if.params}Firebolt::Error status = FireboltSDK::Properties::Get(method, jsonParameters, jsonResult);${end.if.params}
        ${if.params.empty}Firebolt::Error status = FireboltSDK::Properties::Get(method, jsonResult);${end.if.params.empty}
        if (status == Firebolt::Error::None) {
${method.result.instantiation}
        }
        if (err != nullptr) {
            *err = status;
        }

        return ${method.result.name};
    }${method.setter}
