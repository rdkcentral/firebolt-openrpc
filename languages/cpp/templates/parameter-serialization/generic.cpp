        ${if.optional}if (${property}.has_value()) {
            WPEFramework::Core::JSON::Variant ${property}Variant(${property}.value());
            jsonParameters.Set(_T("${property}"), ${property}Variant);
        }${end.if.optional}${if.non.optional}WPEFramework::Core::JSON::Variant ${property}Variant(${property});
        jsonParameters.Set(_T("${property}"), ${property}Variant);${end.if.non.optional}
