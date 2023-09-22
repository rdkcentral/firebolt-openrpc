                auto index((*proxyResponse)->Elements());
                ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}${title} response;
                response.first = index.Get(0);
                response.second = index.Get(1);