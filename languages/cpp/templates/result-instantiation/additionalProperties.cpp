            WPEFramework::Core::JSON::VariantContainer::Iterator variants = jsonResult.Variants();
            while (variants.Next()) {
${if.not.default}                ${namespace}${key} key = WPEFramework::Core::EnumerateType<${namespace}${key}>(variants.Label(), false).Value();${end.if.not.default}${if.default}                ${key} key = variants.Label();${end.if.default}
                ${property}.emplace(std::piecewise_construct,
                    std::forward_as_tuple(key),
                    std::forward_as_tuple(variants.Current().${additional.type}));
            }
