/* ${method.name} - ${method.description} */
uint32_t ${info.title}_Set${method.Name}( ${method.params.withTypes}${if.params}, ${end.if.params}${method.result.type} ${method.result.name} )
{
    const string method = _T("${info.title}.${method.Name}");
    JsonObject jsonParameters;
      ${if.params}
${method.params.instantiation}
      ${end.if.params}

    ${method.result.json} jsonResult;

    uint32_t status = FireboltSDK::Properties::Set(method, jsonParameters, jsonResult);
    if (status == FireboltSDKErrorNone) {
        if (${method.result.name} != nullptr) {
${method.result.instantiation}
        }
    }
    return status;
}
