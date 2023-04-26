/* ${method.name} - ${method.description} */
uint32_t ${info.title}_${method.Name}(${method.params}${if.params}, ${end.if.params}${method.result.type}* ${method.result.name}) {
  uint32_t status = FireboltSDKErrorUnavailable;
  FireboltSDK::Transport<WPEFramework::Core::JSON::IElement>* transport = FireboltSDK::Accessor::Instance().GetTransport();
  if (transport != nullptr) {
  
      JsonObject jsonParameters;

      ${if.params}
${method.params.json}
      ${end.if.params}
  
      WPEFramework::Core::JSON::Boolean jsonResult;
      status = transport->Invoke("${info.title}.${method.name}", jsonParameters, jsonResult);
      if (status == FireboltSDKErrorNone) {
          *success = jsonResult.Value();
      }
  
  } else {
      FIREBOLT_LOG_ERROR(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "Error in getting Transport err = %d", status);
  }
  
  return status;
}