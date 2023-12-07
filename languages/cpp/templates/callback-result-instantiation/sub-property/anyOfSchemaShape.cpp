            ${if.optional}if (proxyResponse->${Property.dependency}${Property}.IsSet()) {
                string ${property}Str;
                proxyResponse->${Property.dependency}${Property}.ToString(${property}Str);
                ${base.title}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = ${property}Str;
            }${end.if.optional}${if.non.optional}string ${property}Str;
            proxyResponse->${Property.dependency}${Property}.ToString(${property}Str);
            ${base.title}${property.dependency}.${property} = ${property}Str;${end.if.non.optional}
