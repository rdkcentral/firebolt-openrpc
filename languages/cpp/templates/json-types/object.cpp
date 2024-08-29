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

        // Function to get value from map using a key
        std::string Get(const std::string& key) const {
            auto it = members.find(key);
            if (it != members.end()) {
                return it->second;
            } else {
                return "Key not found";
            }
        }

    public:
${properties}
    };
