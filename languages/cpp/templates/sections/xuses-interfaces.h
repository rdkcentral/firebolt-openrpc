struct I${info.Title}AsyncResponse {

    virtual ~I${info.Title}AsyncResponse() = default;

    virtual void response(const std::string& result, Firebolt::Error *err) = 0;
};

