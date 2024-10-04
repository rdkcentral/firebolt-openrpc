#include<iostream>
#include <fstream>

#include "gtest/gtest.h"
#include "gmock/gmock.h"

#include <nlohmann/json.hpp>
#include <nlohmann/json-schema.hpp>

using nlohmann::json;
using nlohmann::json_schema::json_validator;
using namespace ::testing;

#define REMOVE_QUOTES(s) (s.substr(1, s.length() - 2))
#define STRING_TO_BOOL(s) (s == "true" ? true : false)


inline std::string capitalizeFirstChar(std::string str) {
    if (!str.empty()) {
        str[0] = std::toupper(str[0]);
    }
    return str;
}


class JsonEngine
{
    private:
        std::ifstream _file;
        nlohmann::json _data;

    public:

        JsonEngine()
        {
            _data = read_json_from_file("../../firebolt-core-open-rpc.json");
        }

        ~JsonEngine(){
            if (_file.is_open())
                _file.close();
        }

        std::string get_value(const std::string& method_name)
        {
            for (const auto &method : _data["methods"])
                {
                    if (method.contains("name") && (method["name"] == method_name))
                    {
                        auto value = method["examples"][0]["result"]["value"];
                        return value.dump();
                    }
                }
            return "";
        }

        json read_json_from_file(const std::string &filename)
        {
            std::ifstream file(filename);
            if (!file.is_open())
            {
                throw std::runtime_error("Could not open file: " + filename);
            }

            json j;
            file >> j;
            return j;
        }

        json resolve_reference(const json &full_schema, const std::string &ref)
        {
            if (ref.find("#/") != 0)
            {
                throw std::invalid_argument("Only internal references supported");
            }

            std::string path = ref.substr(2);
            std::istringstream ss(path);
            std::string token;
            json current = full_schema;

            while (std::getline(ss, token, '/'))
            {
                if (current.contains(token))
                {
                    current = current[token];
                }
                else
                {
                    throw std::invalid_argument("Invalid reference path: " + ref);
                }
            }

            return current;
        }

        json process_schema(json schema, const json &full_schema)
        {
            if (schema.is_object())
            {
                if (schema.contains("$ref"))
                {
                    std::string ref = schema["$ref"];
                    schema = resolve_reference(full_schema, ref);
                }

                for (auto &el : schema.items())
                {
                    el.value() = process_schema(el.value(), full_schema);
                }
            }
            else if (schema.is_array())
            {
                for (auto &el : schema)
                {
                    el = process_schema(el, full_schema);
                }
            }

            return schema;
        }


 #ifdef UNIT_TEST    

        // template <typename RESPONSE>
        void MockRequest(const WPEFramework::Core::JSONRPC::Message* message)
        {
            std::string methodName = capitalizeFirstChar(message->Designator.Value().c_str());

            /* TODO: Add a flag here that will be set to true if the method name is found in the rpc block, u
               Use the flag to validate "Method not found" or other errors from SDK if applicable */
            for (const auto &method : _data["methods"])
            {
                if (method.contains("name") && (method["name"] == methodName))
                {   
                    // Method name validation
                    EXPECT_EQ(methodName, method["name"]);

                    // ID Validation
                    // TODO: Check if id gets incremented by 1 for each request
                    EXPECT_THAT(message->Id, AllOf(Ge(1),Le(std::numeric_limits<int>::max())));

                    // Schema validation
                    const json requestParams = json::parse(message->Parameters.Value());
                    if(method["params"].empty()) {
                        std::cout << "Schema validation for empty parameters" << std::endl;
                        EXPECT_EQ(requestParams, "{}"_json);
                    }
                    else {
                        json_validator validator(nullptr, nlohmann::json_schema::default_string_format_check);
                        const json openRPCParams = method["params"];
                        for (auto& item : openRPCParams.items()) {
                            std::string key = item.key();
                            json currentSchema = item.value();
                            std::string paramName = currentSchema["name"];
                            if (requestParams.contains(paramName)) {
                                json dereferenced_schema = process_schema(currentSchema, _data);
                                try{
                                    validator.set_root_schema(dereferenced_schema["schema"]);
                                    validator.validate(requestParams[paramName]);
                                    std::cout << "Schema validation succeeded" << std::endl;
                                }
                                catch (const std::exception &e){
                                    FAIL() << "Schema validation error: " << e.what() << std::endl;
                                }
                            }
                        }
                    }
                }
            }
        }
        
        template <typename RESPONSE>
        Firebolt::Error MockResponse(WPEFramework::Core::JSONRPC::Message &message, RESPONSE &response)
        {
                std::string methodName = capitalizeFirstChar(message.Designator.Value().c_str());

                // Loop through the methods to find the one with the given name
                for (const auto &method : _data["methods"])
                {
                    if (method.contains("name") && (method["name"] == methodName))
                    {
                        message.Result = method["examples"][0]["result"]["value"].dump();
                    }
                }
            return Firebolt::Error::None;
        }
#endif
};

