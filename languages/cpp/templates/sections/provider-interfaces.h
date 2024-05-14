// Provider Interfaces
struct IProviderSession {
    virtual ~IProviderSession() = default;

    virtual std::string correlationId() const = 0;
};

struct IFocussableProviderSession : virtual public IProviderSession {
    virtual ~IFocussableProviderSession() override = default;

    virtual void focus( Firebolt::Error *err = nullptr ) = 0;
};
    
${providers.list}
