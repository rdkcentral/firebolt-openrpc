        ${if.optional}if (${property}.has_value()) {
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonValue = ${property}.value();
            WPEFramework::Core::JSON::Variant ${property}Variant(jsonValue.Data());
            jsonParameters.Set(_T("${property}"), ${property}Variant);
        }${end.if.optional}${if.non.optional}${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonValue = ${property};
        WPEFramework::Core::JSON::Variant ${property}Variant(jsonValue.Data());
        jsonParameters.Set(_T("${property}"), ${property}Variant);${end.if.non.optional}
