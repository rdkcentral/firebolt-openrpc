    class ${title}: public WPEFramework::Core::JSON::Container {
    public:
        ~${title}() override = default;
  
    public:
        ${title}()
            : WPEFramework::Core::JSON::Container()
        {
${properties.register}
        }

        ${title}(const ${title}& other)
        {
${properties.assign}
        }

        ${title}& operator=(const ${title}& other)
        {
${properties.assign}
            return (*this);
        }

    public:
${properties}
    };
