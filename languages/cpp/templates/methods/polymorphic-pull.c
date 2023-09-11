/* ${method.rpc.name} - ${method.description} */
void ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt_Error *err = nullptr )
{
    int32_t status = Firebolt_Error_Unavailable;

    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
        string correlationId = "";
    ${method.params.serialization.with.indent}

        WPEFramework::Core::JSON::Boolean jsonResult;
        status = transport->Invoke(_T("${info.title.lowercase}.${method.rpc.name}"), jsonParameters, jsonResult);
        if (status == Firebolt_Error_None) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.rpc.name} is successfully pushed with status as %d", jsonResult.Value());
            status = (jsonResult.Value() == true) ? Firebolt_Error_None : Firebolt_Error_NotSupported;
        }
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport");
    }

    return status;
}
