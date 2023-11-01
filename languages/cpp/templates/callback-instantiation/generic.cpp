            WPEFramework::Core::JSON::VariantContainer::Iterator elements = proxyResponse->Variants();
            while (elements.Next()) {
${callback.result.instantiation}
                else if (strcmp(elements.Label(), "context") == 0) {
                    WPEFramework::Core::JSON::VariantContainer::Iterator params = elements.Current().Object().Variants();
                    while (params.Next()) {
        ${callback.param.instantiation.with.indent}
                    }
                } else {
                    ASSERT(false);
                }
            }