    /* ${method.name} - ${method.description} */
   static void ${method.name}Dispatcher(const void* result) {
        // Accessing Metrics methods using singleton Instance
        Firebolt::IFireboltAccessor::Instance().MetricsInterface().${method.name}(${if.result.nonboolean}${if.result.nonvoid}(static_cast<${method.result.json.type}>(const_cast<void*>(result)))${end.if.result.nonvoid}${end.if.result.nonboolean});
    }
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
            WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch> job = WPEFramework::Core::ProxyType<WPEFramework::Core::IDispatch>(WPEFramework::Core::ProxyType<FireboltSDK::Worker>::Create(${method.name}Dispatcher, nullptr));
            WPEFramework::Core::IWorkerPool::Instance().Submit(job);
        }

        if (err != nullptr) {
            *err = status;
        }

        return${if.result.nonvoid} ${method.result.name}${end.if.result.nonvoid};
    }
