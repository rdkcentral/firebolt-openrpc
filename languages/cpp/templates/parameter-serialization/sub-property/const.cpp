            ${if.optional}if (element${property.dependency}.${property}.has_value()) {
                ${base.title}Container.${Property.dependency}${Property} = element${property.dependency}.${property}.value();
            }${end.if.optional}${if.non.optional}${base.title}Container.${Property.dependency}${Property} = element${property.dependency}.${property};${end.if.non.optional}