            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} ${property}Container;
${properties}
        string ${property}Str;
        ${property}Container.ToString(${property}Str);
        WPEFramework::Core::JSON::VariantContainer ${property}VariantContainer(${property}Str);
        WPEFramework::Core::JSON::Variant ${property}Variant = ${property}VariantContainer;
        ${property}Array.Add() = ${property}Variant;