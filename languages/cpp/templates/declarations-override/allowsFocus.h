        /* 
         ${method.name}
         ${method.description}
         */
        void request${method.Name}(${method.signature.params}${if.params}, ${end.if.params}I${info.Title}AsyncResponse& response, Firebolt::Error *err = nullptr ) override;
        void abort${method.Name}(I${info.Title}AsyncResponse& response, Firebolt::Error *err = nullptr) override;
