        WPEFramework::Core::JSON::ArrayType<WPEFramework::Core::JSON::Variant> ${property}Array;
        for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}            ${property}Array.Add() = element;${end.if.non.object}
        }
        WPEFramework::Core::JSON::Variant ${property}Variant;
        ${property}Variant.Array(${property}Array);
        jsonParameters.Set(_T("${property}"), ${property}Variant);