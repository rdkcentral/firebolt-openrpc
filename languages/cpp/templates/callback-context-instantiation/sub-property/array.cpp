                    ${if.impl.array.optional}${base.title}.${property} = std::make_optional<${type}>();${end.if.impl.array.optional}
                    auto index(response.${Property}.Elements());
                    while (index.Next() == true) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}                        ${base.title}.${property}${if.impl.array.optional}.value()${end.if.impl.array.optional}.push_back(index.Current().Value());${end.if.non.object}
                    }