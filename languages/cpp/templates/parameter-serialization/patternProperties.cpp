        ${if.impl.optional}if (${property}.has_value()) {
            WPEFramework::Core::JSON::VariantContainer ${property}Container;
            ${property}Container.FromString(${property}.value());
            WPEFramework::Core::JSON::Variant ${property}Variant(${property}Container);
            jsonParameters.Set(_T("${property}"), ${property}Variant);
        }${end.if.impl.optional}${if.impl.non.optional}WPEFramework::Core::JSON::VariantContainer ${property}Container;
        ${property}Container.FromString(${property});
        WPEFramework::Core::JSON::Variant ${property}Variant(${property}Container);
        jsonParameters.Set(_T("${property}"), ${property}Variant);${end.if.impl.non.optional}
