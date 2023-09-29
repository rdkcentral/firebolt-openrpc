                auto index((*proxyResponse)->Elements());
                ${type} response;
                while (index.Next() == true) {
                    response.push_back(index.Current().Value());
                }