        ${if.impl.optional}if (${property}.has_value()) {
            auto element = ${property}.value();
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} ${property}Container;
${properties}
            string ${property}Str;
            ${property}Container.ToString(${property}Str);
            WPEFramework::Core::JSON::VariantContainer ${property}VariantContainer(${property}Str);
            WPEFramework::Core::JSON::Variant ${property}Variant = ${property}VariantContainer;
            jsonParameters.Set(_T("${property}"), ${property}Variant);
        }${end.if.impl.optional}${if.impl.non.optional}auto element = ${property};
        ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} ${property}Container;
        {
${properties}
        }
        string ${property}Str;
        ${property}Container.ToString(${property}Str);
        WPEFramework::Core::JSON::VariantContainer ${property}VariantContainer(${property}Str);
        WPEFramework::Core::JSON::Variant ${property}Variant = ${property}VariantContainer;
        jsonParameters.Set(_T("${property}"), ${property}Variant);${end.if.impl.non.optional}