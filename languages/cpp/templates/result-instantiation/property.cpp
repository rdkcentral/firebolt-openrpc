${shape}            ${if.non.anyOf}${if.non.array}${if.non.object}${if.optional}if (jsonResult.${Property}.IsSet()) {
                ${base.title}Result${level}.${property} = jsonResult.get("${Property}").${additional.type};
            }${end.if.optional}${if.non.optional}${base.title}Result${level}.${property} = jsonResult.get("${property.raw}").${additional.type};${end.if.non.optional}${end.if.non.object}${end.if.non.array}${end.if.non.anyOf}