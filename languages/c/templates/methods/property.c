/* ${method.rpc.name} - ${method.description} */
int32_t ${info.Title}_Get${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}OUT ${method.result.type}* ${method.result.name} )
{
    const string method = _T("${info.title.lowercase}.${method.rpc.name}");
${if.params}${method.params.serialization}${end.if.params}
    ${method.result.json} jsonResult;
    ${if.params}int32_t status = FireboltSDK::Properties::Get(method, jsonParameters, jsonResult);${end.if.params}
    ${if.params.empty}int32_t status = FireboltSDK::Properties::Get(method, jsonResult);${end.if.params.empty}
    if (status == FireboltSDKErrorNone) {
${method.result.instantiation}
    }
    return status;
}
${method.setter}
