        WPEFramework::Core::JSON::ArrayType<WPEFramework::Core::JSON::Variant> ${Property};
        ${type} ${property} = element.${property}${if.impl.array.optional}.value()${end.if.impl.array.optional};
        for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.enum}            ${Property}.Add() = static_cast<int32_t>(element);${end.if.enum}${if.generic}            ${Property}.Add() = element;${end.if.generic}
        }
        WPEFramework::Core::JSON::Variant ${Property}Variant;
        ${Property}Variant.Array(${Property});
        jsonParameters.Set(_T("${property}"), ${Property}Variant);
