            auto index(proxyResponse->Elements());
            while (index.Next() == true) {
                ${property}.push_back(index.Current().Value());
            }
