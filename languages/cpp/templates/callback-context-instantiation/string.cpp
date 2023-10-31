                if (strcmp(elements.Label(), "${property}") == 0) {
                    ${property} = elements.Current().Value().c_str();
                }