            ${if.namespace.notsame}FirebotlSDK::${info.Title}::${end.if.namespace.notsame}JsonData_${title} elements = (*proxyResponse)->Variants();
            ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}${title} response;
            while (elements.Next()) {
                response.insert(elements.Label(), elements.Current().${additional.type}.Value());
            }