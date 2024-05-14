    /*
     ${method.name}
     ${method.description}
     */
    virtual void request${method.Name}(${method.signature.params}${if.params}, ${end.if.params}I${info.Title}AsyncResponse& response, Firebolt::Error *err = nullptr ) = 0;
    virtual void abort${method.Name}(I${info.Title}AsyncResponse& response, Firebolt::Error *err = nullptr) = 0;
