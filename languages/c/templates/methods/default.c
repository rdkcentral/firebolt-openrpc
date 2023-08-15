/* ${method.rpc.name} - ${method.description} */
int32_t ${info.Title}_${method.Name}( ${method.signature.params}${if.result}${if.params}, ${end.if.params} ${method.result.type}* ${method.result.name}${end.if.result}${if.signature.empty}void${end.if.signature.empty} ) {

    int32_t status = FireboltSDKErrorUnavailable;
    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
  
    ${method.params.serialization.with.indent}
        ${method.result.json.type} jsonResult;
        status = transport->Invoke("${info.title.lowercase}.${method.rpc.name}", jsonParameters, jsonResult);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.rpc.name} is successfully invoked");
    ${method.result.instantiation.with.indent}
        }
  
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
    }
  
    return status;
}
