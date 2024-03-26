/* ${method.name} - ${method.description} */
uint32_t ${info.title}_${method.Name}( ${method.signature.params} )
{
    const string method = _T("${info.title}.${method.name}");
      ${if.params}
${method.params.serialization}
      ${end.if.params}
    return FireboltSDK::Properties::Set(method, jsonParameters);
}
