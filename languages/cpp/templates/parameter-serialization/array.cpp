        WPEFramework::Core::JSON::ArrayType<WPEFramework::Core::JSON::Variant> ${Property};
        for (auto& element: ${property}) {
            ${Property}.Add() = element;
        }
        WPEFramework::Core::JSON::Variant ${Property}Variant;
        ${Property}Variant.Array(${Property});
        jsonParameters.Set(_T("${property}"), ${Property}Variant);
