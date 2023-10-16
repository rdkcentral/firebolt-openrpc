        WPEFramework::Core::JSON::Variant ${Property}(${if.optional}*${end.if.optional}${property});
        jsonParameters.Set(_T("${property}"), ${Property});
