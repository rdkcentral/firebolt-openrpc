                while (jsonResult.Variants().Next()) {
                    ${property}.insert(elements.Label(), elements.Current().${additional.type}.Value()); 
                }