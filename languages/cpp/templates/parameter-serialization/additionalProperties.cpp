        ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}${title} map;
        ${if.impl.optional}if (${property}.has_value()) {
            map = ${property}.value();
        }${end.if.impl.optional}${if.impl.non.optional}map = ${property};${end.if.impl.non.optional}
        WPEFramework::Core::JSON::Variant ${property}Variant;
        for (auto element: map) {
            WPEFramework::Core::JSON::Variant jsonElement = element.second;
            WPEFramework::Core::JSON::VariantContainer jsonContainer;
            jsonContainer.Set(element.first.c_str(), jsonElement);
            ${property}Variant = jsonContainer;
        }
        jsonParameters.Set(_T("${property}"), ${property}Variant);