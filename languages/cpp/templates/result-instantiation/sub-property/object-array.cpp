                ${type} ${property}Value;
            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} jsonResult = index.Current();
${properties}
            ${property}Result.push_back(${property}Value);
