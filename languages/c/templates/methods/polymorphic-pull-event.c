/* ${method.json.name} - ${method.description} */
static void ${info.Title}${method.Name}InnerCallback( void* userCB, const void* userData, void* response )
{
${event.callback.params.serialization}
    ASSERT(jsonResponse->IsValid() == true);
    if (jsonResponse->IsValid() == true) {

        ${info.Title}${method.Name}Callback callback = reinterpret_cast<${info.Title}${method.Name}Callback>(userCB);

        WPEFramework::Core::ProxyType<${method.pulls.param.json.type}>* requestParam = new WPEFramework::Core::ProxyType<${method.pulls.param.json.type}>();
        *requestParam = WPEFramework::Core::ProxyType<${method.pulls.param.json.type}>::Create();
	*(*requestParam) = (*jsonResponse)->${event.pulls.param.name}Parameters;

        ${method.pulls.type} result = reinterpret_cast<${method.pulls.type}>(callback(userData, reinterpret_cast<${method.pulls.param.type}>(requestParam)));

        JsonObject jsonParameters;
        WPEFramework::Core::JSON::Variant CorrelationId = (*jsonResponse)->CorrelationId.Value();
        jsonParameters.Set(_T("correlationId"), CorrelationId);

        ${method.pulls.json.type}& resultObj = *(*(reinterpret_cast<WPEFramework::Core::ProxyType<${method.pulls.json.type}>*>(result)));
        string resultStr;
        resultObj.ToString(resultStr);
        WPEFramework::Core::JSON::VariantContainer resultContainer(resultStr);
        WPEFramework::Core::JSON::Variant Result = resultContainer;
        jsonParameters.Set(_T("result"), Result);

        FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
        if (transport != nullptr) {
            WPEFramework::Core::JSON::Boolean jsonResult;
            uint32_t status = transport->Invoke(_T("${info.title.lowercase}.${method.pulls.for}"), jsonParameters, jsonResult);
            if (status == FireboltSDKErrorNone) {
                FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "${info.Title}.${method.json.name} is successfully pushed with status as %d", jsonResult.Value());
                status = (jsonResult.Value() == true) ? FireboltSDKErrorNone : FireboltSDKErrorNotSupported;
            }
        } else {
            FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport");
        }
    }
}
uint32_t ${info.Title}_Register_${method.Name}( ${info.Title}${method.Name}Callback userCB, const void* userData )
{
    const string eventName = _T("${info.title.lowercase}.${method.json.name}");
    uint32_t status = FireboltSDKErrorNone;

    if (userCB != nullptr) {
    ${event.params.serialization}
        status = FireboltSDK::Event::Instance().Subscribe<${event.result.json.type}>(eventName, jsonParameters, ${info.Title}${method.Name}InnerCallback, reinterpret_cast<void*>(userCB), userData);
    }
    return status;
}
uint32_t ${info.Title}_Unregister_${method.Name}( ${info.Title}${method.Name}Callback userCB)
{
    return FireboltSDK::Event::Instance().Unsubscribe(_T("${info.title.lowercase}.${method.json.name}"), reinterpret_cast<void*>(userCB));
}
