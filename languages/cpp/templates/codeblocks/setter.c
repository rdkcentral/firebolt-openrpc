/* ${method.rpc.name} - ${method.description} */
int32_t ${method.Name}( ${method.signature.params} )
{
    const string method = _T("${info.title.lowercase}.${method.rpc.name}");
${if.params}${method.params.serialization}${end.if.params}
    return FireboltSDK::Properties::Set(method, jsonParameters);
}
