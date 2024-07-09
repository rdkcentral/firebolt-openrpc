#include <iostream>
#include <fstream>
#include <nlohmann/json.hpp>
#include <string>

// // #include <nlohmann/json-schema.hpp>
using nlohmann::json;
// // using nlohmann::json_schema::json_validator;

// using json = nlohmann::json;

class JsonEngine
{
public:
    template <typename RESPONSE>
    static Firebolt::Error MockRequest(WPEFramework::Core::ProxyType<WPEFramework::Core::JSONRPC::Message> message, RESPONSE &response)
    {
        std::cout << "MockRequest method called in JSON engine" << std::endl;
        std::cout << ">>>  JsonEngine Request: " << message->Designator.Value().c_str() << std::endl;
        
        // Open the JSON file. TODO: Use relative path here
        std::ifstream file("firebolt-core-open-rpc.json");
        json data;
        file >> data;
        std::string methodName = message->Designator.Value().c_str();

        // Loop through the methods to find the one with the given name
        // for (const auto &method : data["methods"]) {
        //     if (method.contains("name") && method["name"] == methodName)
        //     {
        //         std::cout << ">>>  Module: " << method << std::endl;
        //     }
        // }

        return Firebolt::Error::None;
    }
    // static Firebolt::Error MockResponse(const string &methodName, const JsonObject &parameters)
    // {
    //     std::cout << "MockResponse method called in JSON engine" << std::endl;

    //     // Open the JSON file
    //     std::ifstream jsonFile("firebolt-core-open-rpc.json");
    //     // Use relative path here
    //     // std::ifstream jsonFile("../..");

    //     //  // Parse the JSON file into a json object
    //     nlohmann::json j;
    //     jsonFile >> j;
    //     std::string response = "";
    //     //  // Loop through the methods to find the one with the given name
    //     for (const auto &method : j["methods"])
    //     {
    //         if (method.contains("name") && method["name"] == methodName)
    //         {
    //             // Loop through the examples of the method
    //             if (method.contains("examples"))
    //             {
    //                 for (const auto &example : method["examples"])
    //                 {
    //                     if (example.contains("result") && example["result"].contains("value"))
    //                     {
    //                         // Convert JSON object to string
    //                         response = example["result"]["value"].dump();
    //                         // Print the result
    //                         std::cout << example["result"]["value"] << std::endl;
    //                     }
    //                 }
    //             }
    //         }
    //     }
    //     std::cout << response << " RESPONSE " << std::endl;

    //     // If no response is found, return an error

    //     return response;
    // }
};
