                if (strcmp(elements.Label(), "${property}") == 0) {
                    WPEFramework::Core::JSON::VariantContainer container = elements.Current().Object();
                    std::string strContainer;
                    container.ToString(strContainer);
                    ${if.namespace.notsame}Firebolt::${info.Title}::${end.if.namespace.notsame}JsonData_${title} response;
                    response.FromString(strContainer);
${properties}
                }