/* ${method.name} - ${method.description} */
uint32_t ${info.title}_Get${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}${method.result.type}* ${method.result.name} )
{
    const string method = _T("${info.title}.${method.name}");
${if.params}${method.params.serialization}${end.if.params}
    ${method.result.json} jsonResult;
    ${if.params}uint32_t status = FireboltSDK::Properties::Get(method, jsonParameters, jsonResult);${end.if.params}
    ${if.params.empty}uint32_t status = FireboltSDK::Properties::Get(method, jsonResult);${end.if.params.empty}
    if (status == FireboltSDKErrorNone) {
        if (${method.result.name} != nullptr) {
${method.result.instantiation}
        }
    }
    return status;
}
${method.setter}
