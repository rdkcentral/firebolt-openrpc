/* ${method.json.name} - ${method.description} */
uint32_t ${info.Title}_${method.Name}( ${method.signature.params}${if.result}${if.params}, ${end.if.params}${method.result.type}* ${method.result.name}${end.if.result}${if.signature.empty}void${end.if.signature.empty} ) {

    uint32_t status = FireboltSDKErrorUnavailable;
    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
  
    ${method.params.serialization.with.indent}
        ${method.result.json.type} jsonResult;
        status = transport->Invoke("${info.title.lowercase}.${method.json.name}", jsonParameters, jsonResult);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.json.name} is successfully invoked");
${method.result.instantiation}
        }
  
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
    }
  
    return status;
}
