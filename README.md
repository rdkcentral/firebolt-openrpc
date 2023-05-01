---
title: Firebolt OpenRPC 2.0
---
# Firebolt OpenRPC 2.0
Tools to enable consistent Firebolt SDK and document generation.

## Overview
Version 2.0 of `firebolt-openrpc` has two major changes.

- Support for slicing up an OpenRPC API into multiple SDK artifacts
- Normalize most tasks to take a single OpenRPC document as input, rather than a directory full of "modules"

### OpenRPC task
The `openrpc` task takes a single OpenRPC document and "Fireboltizes" it, i.e. Interprets Firebolt method tags and inserts external Markdown descriptions via JSON-Schema $ref.

This task continues to support a directory of modules and will merge and Fireboltize them into a single file.

### Slice task
To support outputting multipel SDK's, there is a new `slice` task. This task takes a single OpenRPC document and slices it into separate OpenRPC documents based on a provided `sdk.config.json`, e.g.:

```json
{
  "info": {
    "title": "Firebolt Core SDK",
  },
  "methods": [
    {
      "module": "Lifecycle",
      "use": [
        "xrn:firebolt:capability:lifecycle:ready"
        "xrn:firebolt:capability:lifecycle:ready"
      ],
      "manage": [],
      "provide": [
        "xrn:firebolt:capability:discovery:entityInfo",
        "xrn:firebolt:capability:discovery:purchases"
      ]
    }
  ]
}
```

The `info.title` attribute is copied to the output, and each entry in the `methods` array is used to query methods from the input using module names and capabilities.

Any `info.x-` extension attributes will also be copied from the sdk.config.json into the output OpenRPC document.

Generally, this task is run using the output of the `openrpc` task as input, however, it's not required.

Wildcards are supported in `module` as well as `use`, `manage`, and `provide`.

## SDK, Declarations, and Docs
These tasks all take a single OpenRPC document and generate their respective artifacts.

They all have the same arguments and are all implemented using shared code for more consistency.

--input: The input OpenRPC document
--output: The output location
--template: An optional template directory for adding to and overriding the built in templates


## Firebolt Method Tags
* __event__ - When a method is tagged with this then it will be treated as an asynchronous event. The call to subscribe to the event will return a success reponse and then zero or more asynchronous responses with the same id. These responses correlate to the event happening. Events are documented in a different section of the module. The app can use the event not through a specific method call but by doing `Module.listen('eventName')`
* __exclude-from-sdk__ - When a method is tagged with this then no SDK method is generated. Instead, custom code for that method is used. This is often used for methods that have client code associated with it instead of just calling the Transport directly.
* __polymorphic-pull__ - Instructs the code generation to generate a single method that be used for both pushing data to Firebolt or registering a callback that Firebolt can use to pull data from the application.
* __polymorphic-reducer__ - Instructs the code generation to generate a single method that can take a single object or an array of objects.
* __rpc-only__ - No SDK method or docs are generated for this method, but FireboltOS should still handle the RPC call. This is used for internal communication within the SDK to FireboltOS, but is not meant to be consumed by an application.
* __synchronous__ - Almost all firebolt methods are asynchronous because they make an asynchronous call through the Transport. Some calls which are handled entirely client side can be marked as synchronous and thus do not return a Promise.
* __calls-metrics__ - Whenever the method is called, another call is made to produce a metric for that method call.
* __property__ - Generates a single method that can be used as a getter, setter, and subscription based on the arguments the app gives to that method call.
* __property:readonly__ - Generates a single method that can be used as a getter and subscription based on the arguments the app gives to that method call.
* __property:immutable__ - Generates a single method that can be used as a getter based on the arguments the app gives to that method call.

## OpenRPC Validation

Indicated by `--task validate`. Reads and validates a corpus of individual OpenRPC documents and validates the result of assembling them together into a single OpenRPC document.
