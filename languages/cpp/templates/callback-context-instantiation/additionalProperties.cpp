                if (strcmp(elements.Label(), "${property}") == 0) {
                    ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title}::Iterator elements = elements.Current().Variants();
                    while (elements.Next()) {
//Relook                      ${property}.insert(elements.Label(), elements.Current().${additional.type};
                    }
                }
