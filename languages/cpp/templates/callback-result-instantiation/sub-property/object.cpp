${if.optional}            if (proxyResponse->${Property.dependency}IsSet()) {
                ${base.title}${property.dependency} = std::make_optional<${type}>();
${properties}
            }${end.if.optional}${if.non.optional}            {
${properties}
            }${end.if.non.optional}