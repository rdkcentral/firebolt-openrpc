        ${if.optional}if (${property}.has_value()) {
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonValue_${property} = ${property}.value();
            WPEFramework::Core::JSON::Variant ${property}Variant(jsonValue_${property}.Data());
            jsonParameters.Set(_T("${property}"), ${property}Variant);
        }${end.if.optional}${if.non.optional}${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonValue_${property} = ${property};
        WPEFramework::Core::JSON::Variant ${property}Variant(jsonValue_${property}.Data());
        jsonParameters.Set(_T("${property}"), ${property}Variant);${end.if.non.optional}