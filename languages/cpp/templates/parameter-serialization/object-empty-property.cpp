        WPEFramework::Core::JSON::Variant ${property}Variant(${property}${if.optional}.value()${end.if.optional});
        jsonParameters.Set(_T("${property}"), ${property}Variant);
