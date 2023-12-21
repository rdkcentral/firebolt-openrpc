            ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}JsonData_${title}::Iterator elements = resultVariant.Variants();
            while (elements.Next()) {
                 ${property}.insert(elements.Label(), elements.Current().${additional.type};
            }