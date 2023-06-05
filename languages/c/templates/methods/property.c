/* ${method.name} - ${method.description} */
uint32_t ${info.title}_Get${method.Name}(${method.params}${if.params}, ${end.if.params}${method.result.type}* ${method.result.name}) {
    const string method = _T("${info.title}.${method.name}");
    FireboltSDK::${info.title}::${method.result.type} jsonResult;

    uint32_t status = FireboltSDK::Properties::Get(method, jsonResult);
    if (status == FireboltSDKErrorNone) {
        WPEFramework::Core::ProxyType<FireboltSDK::${info.title}::${method.result.type}>* resultPtr = new WPEFramework::Core::ProxyType<FireboltSDK::${info.title}::${method.result.type}>();
       *${method.result.name} = static_cast<${info.title}_${method.result.type}Handle>(resultPtr);
    }
    return status;
}
