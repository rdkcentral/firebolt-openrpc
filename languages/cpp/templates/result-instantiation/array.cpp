            auto index(jsonResult.Elements());
            while (index.Next() == true) {
    ${if.object}${items}${end.if.object}${if.non.object}            ${property}.push_back(index.Current().Value());${end.if.non.object}
            }