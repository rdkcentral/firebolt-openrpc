            string ${property}Str;
            jsonResult.${Property.dependency}${Property}.ToString(${property}Str);
            ${base.title}Result${level}.${property.dependency}${if.impl.optional}value().${end.if.impl.optional}${property} = ${property}Str;
