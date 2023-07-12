/* ${method.json.name} - ${method.description} */
uint32_t ${info.Title}_${method.Name}( ${method.signature.params} )
{
    const string method = _T("${info.title.lowercase}.${method.json.name}");
${if.params}${method.params.serialization}${end.if.params}
    return FireboltSDK::Properties::Set(method, jsonParameters);
}
