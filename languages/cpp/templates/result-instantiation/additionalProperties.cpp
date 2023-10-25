            while (jsonResult.Variants().Next()) {
                std::string label = jsonResult.Variants().Label();
                ${property}.emplace(std::piecewise_construct,
                    std::forward_as_tuple(label),
                    std::forward_as_tuple(jsonResult.Variants().Current().${additional.type}));
            }