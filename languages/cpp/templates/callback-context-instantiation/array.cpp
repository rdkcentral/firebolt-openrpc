                if (strcmp(elements.Label(), "${property}") == 0) {
                    auto index(element.Current().Elements());
                    while (index.Next() == true) {
                        ${property}.push_back(index.Current().Value());
                    }
                }
