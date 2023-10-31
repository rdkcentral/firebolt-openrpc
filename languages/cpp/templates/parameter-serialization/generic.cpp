        WPEFramework::Core::JSON::Variant ${Property}(${property}${if.optional}.value()${end.if.optional});
        jsonParameters.Set(_T("${property}"), ${Property});