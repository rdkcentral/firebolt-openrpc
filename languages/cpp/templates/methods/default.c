/* ${method.rpc.name} - ${method.description} */
${method.signature.result} ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt_Error *err = nullptr ) {

    int32_t status = Firebolt_Error_Unavailable;
    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
  
    ${method.params.serialization.with.indent}
        ${method.result.json.type} jsonResult;
        status = transport->Invoke("${info.title.lowercase}.${method.rpc.name}", jsonParameters, jsonResult);
        if (status == Firebolt_Error_None) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.rpc.name} is successfully invoked");
    ${method.result.instantiation.with.indent}
        }
  
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
    }
  
    return status;
}
