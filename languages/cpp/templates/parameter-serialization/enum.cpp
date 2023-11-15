        ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonValue = ${property}${if.optional}.value()${end.if.optional};
        WPEFramework::Core::JSON::Variant ${property}Variant(jsonValue.Data());
        jsonParameters.Set(_T("${property}"), ${property}Variant);
