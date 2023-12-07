            ${if.optional}if (proxyResponse->${Property}.IsSet()) {
                ${base.title}.${property} = std::make_optional<${type}>();
                auto index(proxyResponse->${Property}.Elements());
                while (index.Next() == true) {
    ${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${base.title}.${property}.value().push_back(index.Current().Value());${end.if.non.object}
                }
            }${end.if.optional}${if.non.optional}auto index(proxyResponse->${Property}.Elements());
            while (index.Next() == true) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${base.title}.${property}.value().push_back(index.Current().Value());${end.if.non.object}
            }${end.if.non.optional}
