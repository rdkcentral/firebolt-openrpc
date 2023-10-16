    /*
     ${method.name}
     ${method.description}
     ${method.params.annotations}${if.deprecated} * @deprecated ${method.deprecation}${end.if.deprecated}
     */
    virtual ${method.signature.result} ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err = nullptr )${if.result.nonvoid}${if.params.empty} const${end.if.params.empty}${end.if.result.nonvoid} = 0;
