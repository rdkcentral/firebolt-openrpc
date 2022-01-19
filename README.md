---
title: Firebolt OpenRPC Tools
---
# Firebolt OpenRPC Tools
Tools to enable consistent Firebolt SDK and document generation.

- [Firebolt OpenRPC Tools](#firebolt-openrpc-tools)
  - [To Use](#to-use)
  - [CLI Arguments](#cli-arguments)
    - [SDK Generation](#sdk-generation)
      - [Note on --static-modules](#note-on---static-modules)
    - [Document Generation](#document-generation)
      - [Note on --as-path](#note-on---as-path)
    - [OpenRPC Generation](#openrpc-generation)
    - [OpenRPC Validation](#openrpc-validation)
  - [CLI Shorthands](#cli-shorthands)

## To Use

  - First, `npm install`.
  - Next, invoke the cli directly with `src/cli.js`. See below for arguments.

Alternatively, you may install globally using `npm install -g @firebolt-js/openrpc`, which will install the cli and add it to your $PATH so it may be invoked with the `firebolt-openrpc` command.

Firebolt OpenRPC Tools require Node 16.

## CLI Arguments

`--task`: Tell the tool what you want it to do. Options are:

  - `sdk`: Generate the SDK
  - `docs`: Generate the docs
  - `openrpc`: Generate the openrpc
  - `validate` Validate the openrpc

`--source`: The relative or absolute path to the folder or file that the task will use.

`--template`: The relative or absolute path to the folder or file containing template resources for the task.

`--output`: The relative or absolute path to the folder or file that will hold the task's generated output.

`--as-path`: Used by the document generator. This is a toggle for generating content as files vs folders. More info below in [Document Generation](/#document-generation).

`--static-modules`: String. Used by the SDK generator. "Static modules" are modules without an OpenRPC json document. More on this below.

### SDK Generation

Indicated by `--task sdk`. Generate the Firebolt SDKs from an OpenRPC spec. Currently, only the JavaScript SDK is supported.

#### Note on --static-modules

Static modules are modules without a corresponding OpenRPC json document. It will be included statically from the location supplied by the `--template` option. Listing your module in the `--static-modules` property ensures that it is properly exported by the SDK and wires up mock responses as well.

### Document Generation

Indicated by `--task docs`. Generate markdown docs from the OpenRPC spec.

#### Note on --as-path

When deploying docs to web servers, `--as-path` is generally used. For deploying to GitHub pages/wikis, do not use `--as-path`.

This toggle will generate content as files vs folders. For exmaple, this:
```
/docs/Topic.md
```
vs
```
/docs/Topic/index.md
```
It affects the output of:

  - file names
  - relative links
  - relative images

### OpenRPC Generation

Indicated by `--task openrpc`. Assembles a corpus of individual OpenRPC documents into a single OpenRPC document.

#### Tags
* __event__ - When a method is tagged with this then no SDK method is generated. Events are documented in a different section of the module. The app can use the event not through a method call but by doing `Module.listen('eventName')`
* __exclude-from-sdk__ - When a method is tagged with this then no SDK method is generated. Instead, custom code for that method is used. This is often used for methods that have client code associated with it instead of just calling the Transport directly.
* __polymorphic-pull__ - Instructs the code generation to generate a single method that be used for both pushing data to Firebolt or registering a callback that Firebolt can use to pull data from the application.
* __polymorphic-reducer__ - Instructs the code generation to generate a single method that can take a single object or an array of objects.
* __rpc-only__ - No SDK method or docs are generated for this method, but FireboltOS should still handle the RPC call. This is used for internal communication within the SDK to FireboltOS, but is not meant to be consumed by an application.
* __synchronous__ - Almost all firebolt methods are asynchronous because that make an asynchronous call through the Transport. Some calls which are handled entirely client side can be marked as synchronous and thus do not return a Promise.
* __property__ - Generates a single method that can be used as a getter, setter, and subscription based on the arguments the app gives to that method call.
* __property:readonly__ - Generates a single method that can be used as a getter and subscription based on the arguments the app gives to that method call.
* __property:immutable__ - Generates a single method that can be used as a getter based on the arguments the app gives to that method call.

### OpenRPC Validation

Indicated by `--task validate`. Reads and validates a corpus of individual OpenRPC documents and validates the result of assembling them together into a single OpenRPC document.

## CLI Shorthands

Don't feel like typing? Use `-t` instead of `--task`. This table shows the mapping:

| shorthand | command            |
| --------- | ------------------ |
| `-t`      | `--task`           |
| `-s`      | `--source`         |
| `-tm`     | `--template`       |
| `-o`      | `--output`         |
| `-ap`     | `--as-path`        |
| `-sm`     | `--static-modules` |
