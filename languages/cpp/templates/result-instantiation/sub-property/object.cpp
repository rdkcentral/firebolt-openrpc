${if.impl.optional}
            ${base.title}Result${level}${property.dependency} = std::make_optional<${type}>();${end.if.impl.optional}
${properties}