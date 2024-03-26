            ${if.optional}if (jsonResult.${Property}.IsSet()) {
                ${base.title}Result${level}.${property} = std::make_optional<${type}>();
                auto index(jsonResult.${Property}.Elements());
                while (index.Next() == true) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${base.title}Result${level}.${property}.value().push_back(index.Current().Value());${end.if.non.object}
                }
            }${end.if.optional}${if.non.optional}auto index(jsonResult.${Property}.Elements());
            while (index.Next() == true) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                    ${base.title}Result${level}.${property}.push_back(index.Current().Value());${end.if.non.object}
           }${end.if.non.optional}
