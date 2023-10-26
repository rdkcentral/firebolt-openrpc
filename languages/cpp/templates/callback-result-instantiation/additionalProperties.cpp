            ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title}::Iterator elements = (*proxyResponse)->Variants();
            ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}${title} response;
            while (elements.Next()) {
//                response.insert(elements.Label(), elements.Current().${additional.type};
            }
