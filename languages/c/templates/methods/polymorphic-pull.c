/* ${method.name} - ${method.description} */
uint32_t ${info.Title}_Push${method.Name}( ${method.signature.params} )
{
    uint32_t status = FireboltSDKErrorUnavailable;

    string correlationId = "";
${method.params.serialization}
    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
        WPEFramework::Core::JSON::Boolean jsonResult;
        status = transport->Invoke(_T("${info.title}.${method.name}"), jsonParameters, jsonResult);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.name} is successfully pushed with status as %d", jsonResult.Value());
            status = (jsonResult.Value() == true) ? FireboltSDKErrorNone : FireboltSDKErrorNotSupported;
        }
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport");
    }

    return status;
}
