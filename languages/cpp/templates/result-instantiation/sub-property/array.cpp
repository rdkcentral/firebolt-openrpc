            auto index(jsonResult.${Property}.Elements());
            while (index.Next() == true) {
${if.object}${items.with.indent}${end.if.object}${if.non.object}                ${property}.push_back(index.Current().Value());${end.if.non.object}
            }