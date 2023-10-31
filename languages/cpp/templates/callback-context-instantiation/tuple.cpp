                if (strcmp(elements.Label(), "${property}") == 0) {
                    ${property}.first = elements.Current().Get(0);
                    ${property}.second = elements.Current().Get(1);
                }