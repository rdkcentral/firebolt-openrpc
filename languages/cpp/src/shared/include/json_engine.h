// #include<iostream>
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
        std::fstream _file;
        nlohmann::json _data;

    public:

        JsonEngine()
        {
            if (!_file.is_open())
            _file.open("../dist/firebolt-core-open-rpc.json");
            _file >> _data;
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


 #ifndef UNIT_TEST    

        // template <typename RESPONSE>
        void MockRequest(const WPEFramework::Core::JSONRPC::Message* message)
        {
            std::cout << "Inside JSON engine MockRequest function" << std::endl;
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
                    std::cout << "MockRequest actual message.Id.Value(): " << message->Id.Value() << std::endl;
                    EXPECT_THAT(message->Id, AllOf(Ge(1),Le(std::numeric_limits<int>::max())));

                    // Schema validation
                    const json requestParams = json::parse(message->Parameters.Value());
                    std::cout << "Schema validator requestParams JSON: " << requestParams.dump() << std::endl;
                    if(method["params"].empty()) {
                        std::cout << "Params is empty" << std::endl;
                        EXPECT_EQ(requestParams, "{}"_json);
                    }
                    else {
                        std::cout << "Params is NOT empty" << std::endl;
                        const json openRPCSchema = method["params"][0]["schema"];
                        std::cout << "Schema validator schema JSON: " << openRPCSchema.dump() << std::endl;

                        json_validator validator;
                        try{
                            validator.set_root_schema(openRPCSchema);
                            validator.validate(requestParams);
                            // EXPECT_NO_THROW(validator.validate(requestParams)); // For usage without try catch
                            std::cout << "Schema validation succeeded" << std::endl;
                        }
                        catch (const std::exception &e){
                            FAIL() << "Schema validation error: " << e.what() << std::endl;
                        }
                    }

                    // DUMMY SCHEMA VALIDATION - TO BE REMOVED
                    // const json openRPCSchema = R"(
                    //     {
                    //     "title": "AdConfigurationOptions",
                    //     "type": "object",
                    //     "properties": {
                    //         "coppa": {
                    //             "type": "boolean",
                    //             "description": "Whether or not the app requires US COPPA compliance."
                    //         },
                    //         "environment": {
                    //             "type": "string",
                    //             "enum": [
                    //                 "prod",
                    //                 "test"
                    //             ],
                    //             "default": "prod",
                    //             "description": "Whether the app is running in a production or test mode."
                    //         },
                    //         "authenticationEntity": {
                    //             "type": "string",
                    //             "description": "The authentication provider, when it is separate entity than the app provider, e.g. an MVPD."
                    //         }
                    //     }
			        // })"_json;
                    // const json requestParams = json::parse(message->Parameters.Value());
                    // // const json requestParams = R"({"options":{}})"_json;
                    // json_validator validator;
                    // try{
                    //     validator.set_root_schema(openRPCSchema);
                    //     validator.validate(requestParams);
                    //     // EXPECT_NO_THROW(validator.validate(requestParams)); // For usage without try catch
                    //     std::cout << "Schema validation succeeded" << std::endl;
                    // }
                    // catch (const std::exception &e){
                    //     FAIL() << "Schema validation error: " << e.what() << std::endl;
                    // }
                }
            }
        }
        
        template <typename RESPONSE>
        Firebolt::Error MockResponse(WPEFramework::Core::JSONRPC::Message &message, RESPONSE &response)
        {
                std::cout << "Inside JSON engine MockResponse function" << std::endl;
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

