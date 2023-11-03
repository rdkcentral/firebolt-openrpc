    /*
     ${method.rpc.name}
     ${method.description}
     */
    virtual void ${method.name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err = nullptr ) = 0;
