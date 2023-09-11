    /* 
     ${method.name}
     ${method.description}
     ${method.params.annotations}${if.deprecated} * @deprecated ${method.deprecation}${end.if.deprecated}
     */
    virtual ${method.signature.result} ${method.Name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt_Error *err = nullptr ) = 0;
