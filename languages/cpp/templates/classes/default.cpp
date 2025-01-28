    class ${info.Title}${method.Name}Session : virtual public IProviderSession {
    public:
         std::string correlationId () const override
         {
             return _correlationId;
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

            std::unique_ptr<IProviderSession> ${info.title.lowercase}${method.Name}Session = std::make_unique<${info.Title}${method.Name}Session>();
            I${info.Title}Provider& ${info.title.lowercase}Provider = *(reinterpret_cast<I${info.Title}Provider*>(provider));
            ${info.title.lowercase}Provider.${method.name}(${method.result.name}.parameters, std::move(${info.title.lowercase}${method.Name}Session));
        }
    }
