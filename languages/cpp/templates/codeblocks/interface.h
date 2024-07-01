struct I${info.Title}Session : virtual public IFocussableProviderSession {
    virtual ~I${info.Title}Session() override = default;

    virtual void error( ${if.error.namespace.notsame}${parent.Title}::${end.if.error.namespace.notsame}${provider.xerror.name} error, Firebolt::Error *err = nullptr ) = 0;
    virtual void result( ${if.result.namespace.notsame}${parent.Title}::${end.if.result.namespace.notsame}${provider.xresponse.name} result, Firebolt::Error *err = nullptr ) = 0;
};

struct I${info.Title}Provider {
    virtual ~I${info.Title}Provider() = default;

${methods}
};