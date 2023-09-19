                WPEFramework::Core::ProxyType<FireboltSDK::${info.Title}::${title}>* resultPtr = new WPEFramework::Core::ProxyType<FireboltSDK::${info.Title}::${title}>();
                *resultPtr = WPEFramework::Core::ProxyType<FireboltSDK::${info.Title}::${title}>::Create();
                *(*resultPtr) = jsonResult;
                *${property} = static_cast<${info.Title}_${title}>(resultPtr);