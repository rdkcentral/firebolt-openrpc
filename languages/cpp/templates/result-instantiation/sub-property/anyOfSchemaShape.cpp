            ${if.optional}if (jsonResult.${Property.dependency}${Property}.IsSet()) {
                string ${property}Str;
                jsonResult.${Property.dependency}${Property}.ToString(${property}Str);
                ${base.title}Result${level}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = ${property}Str;
            }${end.if.optional}${if.non.optional}string ${property}Str;
            jsonResult.${Property.dependency}${Property}.ToString(${property}Str);
            ${base.title}Result${level}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = ${property}Str;${end.if.non.optional}
