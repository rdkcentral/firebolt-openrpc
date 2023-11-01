            while (jsonResult.Variants().Next()) {
${if.not.default}                ${namespace}${key} key = WPEFramework::Core::EnumerateType<${namespace}${key}>(jsonResult.Variants().Label(), false).Value();${end.if.not.default}
${if.default}                ${key} key = jsonResult.Variants().Label();${end.if.default}
                ${property}.emplace(std::piecewise_construct,
                    std::forward_as_tuple(key),
                    std::forward_as_tuple(jsonResult.Variants().Current().${additional.type}));
            }