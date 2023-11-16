        WPEFramework::Core::JSON::ArrayType<${json.type}> ${property}Array;
        ${type} ${property} = element${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}${if.impl.array.optional}.value()${end.if.impl.array.optional};
        for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}            ${property}Array.Add() = element;${end.if.non.object}
        }
        ${base.title}Container.${Property.dependency}Add(_T("${property}"), &${property}Array);