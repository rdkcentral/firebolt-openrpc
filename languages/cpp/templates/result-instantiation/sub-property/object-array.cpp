                ${type} ${property}Result${level};
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonResult = index.Current();
${properties}
            ${property}Result.${property}${if.impl.optional}.value()${end.if.impl.optional}.push_back(${property}Result${level});