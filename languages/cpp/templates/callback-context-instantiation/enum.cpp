                if (strcmp(elements.Label(), "${property}") == 0) {
                   ${property} = WPEFramework::Core::EnumerateType<${if.namespace.notsame}${info.Title}::${end.if.namespace.notsame}${title}>(elements.Current().String().c_str(), false).Value();
                }
