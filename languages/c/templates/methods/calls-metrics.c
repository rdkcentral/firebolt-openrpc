/* ${method.rpc.name} - ${method.description} */
void Metrics_${method.Name}Dispatcher(const void*${if.result} result${end.if.result}) {
    Metrics_${method.Name}(${if.result}(static_cast<${method.result.json.type}>(const_cast<void*>(result)))${end.if.result});
}
uint32_t ${info.Title}_${method.Name}( ${method.signature.params}${if.result}${if.params}, ${end.if.params}OUT ${method.result.type}* ${method.result.name}${end.if.result}${if.signature.empty}void${end.if.signature.empty} ) {

    uint32_t status = FireboltSDKErrorUnavailable;
    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
  
    ${method.params.serialization.with.indent}
        ${method.result.json.type} jsonResult;
        status = transport->Invoke("${info.title}.${method.rpc.name}", jsonParameters, jsonResult);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.rpc.name} is successfully invoked");
    ${method.result.instantiation.with.indent}

            void* result = nullptr;
            ${if.result}result = static_cast<void*>(new ${method.result.json.type});${end.if.result}
            WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch> job = WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch>(WPEFramework::Core::ProxyType<FireboltSDK::Worker>::Create(Metrics_${method.Name}Dispatcher, result));
            WPEFramework::Core::IWorkerPool::Instance().Submit(job);
        }
  
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
    }
  
    return status;
}

