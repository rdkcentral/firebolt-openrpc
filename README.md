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
