                ${type} ${property}Result${level};
                ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonResult = index.Current();
${properties}
                ${base.title}.${property}${if.impl.array.optional}.value()${end.if.impl.array.optional}.push_back(${property}Result${level});