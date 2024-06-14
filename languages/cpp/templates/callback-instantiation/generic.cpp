            std::string str;
            proxyResponse->ToString(str);
            WPEFramework::Core::JSON::VariantContainer variantContainer(str);
            WPEFramework::Core::JSON::Variant resultVariant;
            if (variantContainer.HasLabel("context") == true) {
                WPEFramework::Core::JSON::VariantContainer::Iterator elements = variantContainer.Variants();
                while (elements.Next()) {
    ${callback.result.initialization.with.indent}
                    else if (strcmp(elements.Label(), "context") == 0) {
                        WPEFramework::Core::JSON::VariantContainer::Iterator params = elements.Current().Object().Variants();
                        while (params.Next()) {
            ${callback.param.instantiation.with.indent}
                        }
                    } else {
                        ASSERT(false);
                    }
                }
            } else {
                resultVariant = variantContainer;
            }

${callback.result.instantiation}
