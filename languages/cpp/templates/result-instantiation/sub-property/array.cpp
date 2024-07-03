            ${if.optional}if (jsonResult${Property.dependency}.${Property}.IsSet()) {
                ${base.title}Result${level}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = std::make_optional<${type}>();
                auto index(jsonResult${Property.dependency}.${Property}.Elements());
                while (index.Next() == true) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${base.title}Result${level}.${property}.value().push_back(index.Current().Value());${end.if.non.object}
                }
            }${end.if.optional}${if.non.optional}auto index(jsonResult.${Property}.Elements());
            while (index.Next() == true) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                    ${base.title}Result${level}.${property}.push_back(index.Current().Value());${end.if.non.object}
           }${end.if.non.optional}
