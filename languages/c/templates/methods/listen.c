static void ${info.title}${method.Name}InnerCallback( void* userCB, const void* userData, void* response )
{
    WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::VariantContainer>* jsonResponse = static_cast<WPEFramework::Core::ProxyType<WPEFramework::Core::JSON::VariantContainer>*>(response);
    ASSERT(jsonResponse->IsValid() == true);
    On${info.title}${method.Name}Changed callback = reinterpret_cast<On${info.title}${method.Name}Changed>(userCB);
    callback(userData, static_cast<Types_BooleanMapHandle>(jsonResponse));

}

/* ${method.name} - ${method.description} */
uint32_t ${info.title}_Register_${method.Name}Update( On${info.title}${method.Name}Changed userCB, const void* userData )
{
    const string eventName = _T("${info.title}.${method.name}");
    uint32_t status = FireboltSDKErrorNone;
    if (userCB != nullptr) {
        JsonObject jsonParameters;

        status = FireboltSDK::Properties::Subscribe<WPEFramework::Core::JSON::VariantContainer>(eventName, jsonParameters, ${info.title}${method.Name}InnerCallback, reinterpret_cast<void*>(userCB), userData);
    }
    return status;
}

uint32_t ${info.title}_Unregister_${method.Name}( On${info.title}${method.Name}Changed userCB)
{
    return FireboltSDK::Properties::Unsubscribe(_T("${info.title}.${method.name}"), reinterpret_cast<void*>(userCB));
}