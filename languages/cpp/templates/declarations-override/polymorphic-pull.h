        /*
         ${method.name}
         ${method.description}
         */
        ${method.signature.result} ${method.name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err = nullptr )${if.result.nonvoid}${if.params.empty} const${end.if.params.empty}${end.if.result.nonvoid} override;
