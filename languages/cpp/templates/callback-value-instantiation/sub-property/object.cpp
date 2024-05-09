${if.impl.optional}            ${base.title}${property.dependency} = std::make_optional<${type}>();${end.if.impl.optional}
            {
${properties}
            }