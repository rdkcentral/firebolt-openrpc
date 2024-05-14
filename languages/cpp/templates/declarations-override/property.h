        /*
         * ${method.description}
         * ${method.params}
         */
        ${method.signature.result} ${method.name}( ${method.signature.params}${if.params}, ${end.if.params}Firebolt::Error *err = nullptr ) const override;