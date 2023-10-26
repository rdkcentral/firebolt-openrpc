            while (jsonResult.Variants().Next()) {
                ${if.not.default}${namespace}JsonData_${key} jsonKey;// = jsonResult.Variants().Label();
                ${namespace}${key} key = jsonKey.Value();${end.if.not.default}
                ${if.default}${key} key = jsonResult.Variants().Label();${end.if.default}
                ${property}.emplace(std::piecewise_construct,
                    std::forward_as_tuple(key),
                    std::forward_as_tuple(jsonResult.Variants().Current().${additional.type}));
            }
