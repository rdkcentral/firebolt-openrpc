            ${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}JsonData_${title}::Iterator elements = proxyResponse->Variants();
            while (elements.Next()) {
${if.not.default}                ${namespace}${key} key = WPEFramework::Core::EnumerateType<${namespace}${key}>(elements.Label(), false).Value();${end.if.not.default}
${if.default}                ${key} key = elements.Label();${end.if.default}
                ${property}.emplace(std::piecewise_construct,
                    std::forward_as_tuple(key),
                    std::forward_as_tuple(elements.Current().${additional.type}));
            }
