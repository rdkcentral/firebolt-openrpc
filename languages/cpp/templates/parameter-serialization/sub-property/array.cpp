        WPEFramework::Core::JSON::ArrayType<${json.type}> ${Property};
        ${type} ${property} = element${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}${if.impl.array.optional}.value()${end.if.impl.array.optional};
        for (auto& element : ${property}) {
${if.object}${items.with.indent}${end.if.object}${if.generic}            ${Property}.Add() = element;${end.if.generic}
        }
        ${base.Title}Container.${Property.dependency}Add(_T("${property}"), &${Property});