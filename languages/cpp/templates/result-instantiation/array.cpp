            auto index(jsonResult.Elements());
            while (index.Next() == true) {
                ${property}.push_back(index.Current().Value());
            }
