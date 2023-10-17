        WPEFramework::Core::JSON::ArrayType<WPEFramework::Core::JSON::Variant> ${Property};
        for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}${Property}.Add() = element;${end.if.non.object}
        }
        WPEFramework::Core::JSON::Variant ${Property}Variant;
        ${Property}Variant.Array(${Property});
        jsonParameters.Set(_T("${property}"), ${Property}Variant);
