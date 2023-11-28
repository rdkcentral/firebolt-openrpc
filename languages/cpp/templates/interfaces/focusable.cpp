    class ${info.Title}${method.Name}Session : virtual public I${info.Title}Session {
    public:
        ${info.Title}${method.Name}Session( const std::string& correlationId )
        : _correlationId(correlationId)
        {
        }

        std::string correlationId() const override
        {
            return _correlationId;
        }
        void focus( Firebolt::Error *err = nullptr ) override
        {
            ProviderFocusSession("${info.title.lowercase}.${method.name}Focus", _correlationId, err);
        }
        void result( ${provider.xresponse.name} response,  Firebolt::Error *err = nullptr ) override
        {
            ProviderResultSession("${info.title.lowercase}.${method.name}Response", _correlationId, response, err);
        }
        void error( ${provider.xerror.name} error,  Firebolt::Error *err = nullptr ) override
        {
            ProviderErrorSession("${info.title.lowercase}.${method.name}Error", _correlationId, error, err);
        }

    public:
        std::string _correlationId;
    };
    static void ${info.Title}${method.Name}SessionInnerCallback( void* provider, const void* userData, void* jsonResponse )
    {
${event.callback.serialization}
        ASSERT(proxyResponse.IsValid() == true);

        if (proxyResponse.IsValid() == true) {
${event.callback.initialization}

${event.callback.instantiation}
            proxyResponse.Release();

            std::unique_ptr<I${info.Title}Session> ${info.title.lowercase}${method.Name}Session = std::make_unique<${info.Title}${method.Name}Session>(${method.result.name}.correlationId);
            I${info.Title}Provider& ${info.title.lowercase}Provider = *(reinterpret_cast<I${info.Title}Provider*>(provider));
            ${info.title.lowercase}Provider.${method.name}(${method.result.name}.parameters, std::move(${info.title.lowercase}${method.Name}Session));
        }
    }

