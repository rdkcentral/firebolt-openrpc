/* ${method.name} - ${method.description} */
int F${info.title}_Get${method.Name}(${method.signature.params}${if.result.properties}${if.params}, ${end.if.params}${end.if.result.properties}${method.result.properties}) {
    const string method = _T("${info.title}.${method.name}");
// property
${if.params}${method.params.serialization}${end.if.params}
    ${method.result.json} jsonResult;
    ${if.params}int status = FireboltSDK::Properties::Get(method, jsonParameters, jsonResult);${end.if.params}
    ${if.params.empty}int status = FireboltSDK::Properties::Get(method, jsonResult);${end.if.params.empty}
    if (status == FireboltSDKErrorNone) {
        if (${method.result.name} != nullptr) {
${method.result.instantiation}
        }
    }
    return status;
}
${method.setter}
