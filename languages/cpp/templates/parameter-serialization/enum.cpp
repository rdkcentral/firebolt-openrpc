        ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonValue = ${property};
        WPEFramework::Core::JSON::Variant ${Property}(jsonValue.Data());
        jsonParameters.Set(_T("${property}"), ${Property});