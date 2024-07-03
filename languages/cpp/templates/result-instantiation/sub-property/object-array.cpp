                ${type} ${property}Result${level};
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonResult = index.Current();
            {
${properties}
            }
            ${base.title}Result${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property}->push_back(${property}Result${level});