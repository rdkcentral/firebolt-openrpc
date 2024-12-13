    /* ${method.name} - ${method.description} */
    ${method.signature.result} ${info.Title}Impl::${method.name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err ) ${if.result.nonvoid}${if.params.empty} const${end.if.params.empty}${end.if.result.nonvoid}
    {
        Firebolt::Error status = Firebolt::Error::NotConnected;
${if.result.nonvoid}${method.result.initialization}${end.if.result.nonvoid}

        JsonObject jsonParameters;
${method.params.serialization.with.indent}
        ${method.result.json.type} jsonResult;
        status = FireboltSDK::Gateway::Instance().Request("${info.title.lowercase}.${method.name}", jsonParameters, jsonResult);
        if (status == Firebolt::Error::None) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.name} is successfully invoked");
${if.result.nonvoid}${method.result.instantiation.with.indent}${end.if.result.nonvoid}
        }

        if (err != nullptr) {
            *err = status;
        }

        return${if.result.nonvoid} ${method.result.name}${end.if.result.nonvoid};
    }
