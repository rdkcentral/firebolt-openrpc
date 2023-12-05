        WPEFramework::Core::JSON::ArrayType<WPEFramework::Core::JSON::Variant> ${property}Array;
        ${if.impl.array.optional}if (${property}.has_value()) {
            for (auto& element : ${property}.value()) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}             ${property}Array.Add() = element;${end.if.non.object}
            }
        }${end.if.impl.array.optional}${if.impl.array.non.optional}for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}             ${property}Array.Add() = element;${end.if.non.object}
        }${end.if.impl.array.non.optional}
        WPEFramework::Core::JSON::Variant ${property}Variant;
        ${property}Variant.Array(${property}Array);
        jsonParameters.Set(_T("${property}"), ${property}Variant);