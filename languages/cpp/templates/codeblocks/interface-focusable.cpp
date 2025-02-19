  static void ProviderInvokeSession(std::string& methodName, JsonObject& jsonParameters, Firebolt::Error *err = nullptr)
  {
      Firebolt::Error status = Firebolt::Error::NotConnected;

      JsonObject jsonResult;
      status = FireboltSDK::Gateway::Instance().Request("${info.title.lowercase}.${method.name}", jsonParameters, jsonResult);
      if (status == Firebolt::Error::None) {
          FIREBOLT_LOG_INFO(FireboltSDK::Logger::Category::OpenRPC, FireboltSDK::Logger::Module<FireboltSDK::Accessor>(), "%s is successfully invoked", methodName.c_str());
      }

      if (err != nullptr) {
          *err = status;
      }
  }

${methods}
