/* ${method.name} - ${method.description} */
static void ${info.Title}${method.Name}InnerCallback( void* userCB, const void* userData, void* response )
{
${event.callback.params.serialization}
    ASSERT(jsonResponse->IsValid() == true);
    if (jsonResponse->IsValid() == true) {
${event.callback.result.instantiation}
        ${info.Title}${method.Name}Callback callback = reinterpret_cast<${info.Title}${method.Name}Callback>(userCB);
        callback(userData, ${event.callback.response.instantiation});
    }
}
int ${info.title}_Register_${method.Name}( ${event.signature.params}${if.event.params}, ${end.if.event.params}${info.Title}${method.Name}Callback userCB, const void* userData )
{
    const string eventName = _T("${info.title}.${method.name}");
    int status = FireboltSDKErrorNone;

    if (userCB != nullptr) {
    ${event.params.serialization}
        status = FireboltSDK::Event::Instance().Subscribe<${event.result.json.type}>(eventName, jsonParameters, ${info.Title}${method.Name}InnerCallback, reinterpret_cast<void*>(userCB), userData);
    }
    return status;
}
int ${info.title}_Unregister_${method.Name}( ${info.Title}${method.Name}Callback userCB)
{
    return FireboltSDK::Event::Instance().Unsubscribe(_T("${info.title}.${method.name}"), reinterpret_cast<void*>(userCB));
}
