        auto element = ${property}${if.impl.optional}.value()${end.if.impl.optional};
        ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} ${Property}Container;
${properties}
        string ${Property}Str;
        ${Property}Container.ToString(${Property}Str);
        WPEFramework::Core::JSON::VariantContainer ${Property}VariantContainer(${Property}Str);
        WPEFramework::Core::JSON::Variant ${Property} = ${Property}VariantContainer;
        jsonParameters.Set(_T("${property}"), ${Property});
