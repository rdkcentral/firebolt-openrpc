                ${type} ${property}Result${level};
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonResult = ${property}Index.Current();
            {
${properties}
            }
            ${base.title}Result${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}${if.optional}.value()${end.if.optional}.push_back(${property}Result${level});