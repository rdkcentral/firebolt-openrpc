            string ${property}Str;
            response${Property.dependency}.${Property}.ToString(${property}Str);
            ${base.title}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = ${property}Str;
