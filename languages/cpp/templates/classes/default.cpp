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
        //TODO: code to convert jsonResponse to ${method.name} session
        I${info.Title}Provider& ${info.title.lowercase}Provider = *(reinterpret_cast<I${info.Title}Provider*>(provider));
        ${info.title.lowercase}Provider.${method.name}( parameters, session );
    }

