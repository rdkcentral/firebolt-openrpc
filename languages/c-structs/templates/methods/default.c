/* ${method.name} - ${method.description} */
int F${info.title}_${method.Name}(${method.signature.params}${if.result.properties}${if.params}, ${end.if.params}${end.if.result.properties}${method.result.properties}) {
  int status = FireboltSDKErrorUnavailable;
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
