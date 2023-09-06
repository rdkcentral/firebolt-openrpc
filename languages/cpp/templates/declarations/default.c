    /* 
    ${method.name}
    ${method.description}
    ${method.params.annotations}${if.deprecated} * @deprecated ${method.deprecation}${end.if.deprecated}
    */
    virtual int32_t ${method.Name}( ${method.signature.params}${if.result.nonvoid}${if.params}, ${end.if.params}${method.result.type}& ${method.result.name}${end.if.result.nonvoid} ) = 0;
