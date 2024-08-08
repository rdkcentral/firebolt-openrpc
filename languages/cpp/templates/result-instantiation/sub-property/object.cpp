${if.optional}            if (jsonResult${Property.dependency}.IsSet()) {
                ${base.title}Result${level}${property.dependency} = std::make_optional<${type}>();
${properties}
            }${end.if.optional}${if.non.optional}            {
${properties}
            }${end.if.non.optional}