${shape}          ${if.non.array}${if.non.object}${if.optional}if (jsonResult${Property.dependency}.${Property}.IsSet()) {
                ${base.title}Result${level}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = jsonResult${Property.dependency}.${Property};
            }${end.if.optional}${if.non.optional}${base.title}Result${level}${property.dependency}${if.impl.optional}.value()${end.if.impl.optional}.${property} = jsonResult${Property.dependency}.${Property};${end.if.non.optional}${end.if.non.object}${end.if.non.array}
