            ${if.impl.array.optional}if (element${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}.has_value()) {
                WPEFramework::Core::JSON::ArrayType<${json.type}> ${property}Array;
                ${type} ${property} = element${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}.value();
                for (auto& element : ${property}) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${property}Array.Add() = element;${end.if.non.object}
                }
                ${base.title}Container.${Property.dependency}Add(_T("${property}"), &${property}Array);
            }${end.if.impl.array.optional}${if.impl.array.non.optional}WPEFramework::Core::JSON::ArrayType<${json.type}> ${property}Array;
            ${type} ${property} = element${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property};
            for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${property}Array.Add() = element;${end.if.non.object}
            }
            ${base.title}Container.${Property.dependency}Add(_T("${property}"), &${property}Array);${end.if.impl.array.non.optional}
