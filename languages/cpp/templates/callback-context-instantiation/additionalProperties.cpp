                if (strcmp(elements.Label(), "${property}") == 0) {
                    ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}JsonData_${title}::Iterator elements = elements.Current().Variants();
                    while (elements.Next()) {
                        ${property}.insert(elements.Label(), elements.Current().${additional.type};
                    }
                }
