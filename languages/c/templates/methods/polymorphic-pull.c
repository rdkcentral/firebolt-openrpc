/* ${method.name} - ${method.description} */
uint32_t ${info.title}_Push${method.Name}( ${method.signature.params} )
{
    uint32_t status = FireboltSDKErrorUnavailable;

    JsonObject jsonParameters;

    WPEFramework::Core::JSON::Variant CorrelationId = "";
    jsonParameters.Set(_T("correlationId"), CorrelationId);

    WPEFramework::Core::JSON::Variant Result = result;
    jsonParameters.Set(_T("result"), Result);

    FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
    if (transport != nullptr) {
        WPEFramework::Core::JSON::Boolean jsonResult;
        status = transport->Invoke(_T("${info.title}.${method.name}"), jsonParameters, jsonResult);
        if (status == FireboltSDKErrorNone) {
            FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.title}.${method.name} is successfully pushed with status as %d", jsonResult.Value());
            status = (jsonResult.Value() == true) ? FireboltSDKErrorNone : FireboltSDKErrorNotSupported;
        }
    } else {
        FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport");
    }

    return status;
}
