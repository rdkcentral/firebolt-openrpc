        WPEFramework::Core::JSON::ArrayType<${json.type}> ${Property};
        for (auto& element: ${property}) {
            ${Property}.Add() = element;
        }
        WPEFramework::Core::JSON::Variant ${Property}Variant(${Property});
        jsonParameters.Set(_T("${property}"), ${Property}Variant);
