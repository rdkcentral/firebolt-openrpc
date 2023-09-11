/* ${method.rpc.name} - ${method.description} */
${method.signature.result} ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt_Error *err = nullptr )
{
    const string method = _T("${info.title.lowercase}.${method.rpc.name}");
${if.params}${method.params.serialization}${end.if.params}
    ${method.result.json} jsonResult;
    ${if.params}int32_t status = FireboltSDK::Properties::Get(method, jsonParameters, jsonResult);${end.if.params}
    ${if.params.empty}int32_t status = FireboltSDK::Properties::Get(method, jsonResult);${end.if.params.empty}
    if (status == Firebolt_Error_None) {
${method.result.instantiation}
    }
    return status;
}
${method.setter}
