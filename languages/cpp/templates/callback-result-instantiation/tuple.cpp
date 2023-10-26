                ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}${title} response;
                response.first = (*proxyResponse)->Get(0);
                response.second = (*proxyResponse)->Get(1);