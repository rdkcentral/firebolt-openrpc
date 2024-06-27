            ${if.optional}if ((*proxyResponse)${Property.dependency}.${Property}.IsSet()) {
                ${base.title}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = std::make_optional<${type}>();
                auto index((*proxyResponse)${Property.dependency}.${Property}.Elements());
                while (index.Next() == true) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${base.title}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}.value().push_back(index.Current().Value());${end.if.non.object}
                }
            }${end.if.optional}${if.non.optional}auto index((*proxyResponse)${Property.dependency}.${Property}.Elements());
            while (index.Next() == true) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${base.title}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}.push_back(index.Current().Value());${end.if.non.object}
            }${end.if.non.optional}
