            string ${property}Str;
            (*proxyResponse)->${Property.dependency}${Property}.ToString(${property}Str);
            response.${property.dependency}${if.impl.optional}value().${end.if.impl.optional}${property} = ${property}Str;
