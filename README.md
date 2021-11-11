---
title: Firebolt OpenRPC Tools
---
# Firebolt OpenRPC Tools
Tools to enable consistent Firebolt SDK and document generation.

## To Use

  - First, `npm install`.
  - Next, invoke the cli directly with `src/cli.js`. See below for arguments.

Alternatively, you may install globally using `npm install -g @firebolt-js/openrpc`, which will install the cli and add it to your $PATH so it may be invoked with the `firebolt-openrpc` command. However, trying this at the time of writing, it did not work.

## CLI Arguments

`--task`: Tell the tool what you want it to do. Options are:

  - `sdk`: Generate the SDK
  - `docs`: Generate the docs
  - `openrpc`: Generate the openrpc
  - `validate` Validate the openrpc

`--source`: The relative or absolute path to the folder or file that the task will use.

`--template`: The relative or absolute path to the folder or file containing template resources for the task.

`--output`: The relative or absolute path to the folder or file that will hold the task's generated output.

`--as-path`: This has some effect on the document generation task. Not sure what.

`--static-modules`: Used by the SDK generator. Makes sure that statically defined modules get exported. An example is `Platform`.

### SDK Generation

Indicated by `--task sdk`. Generate the Firebolt SDKs from an OpenRPC spec. Currently, only the JavaScript SDK is supported.

### Document Generation

Indicated by `--task docs`. Generate markdown docs from the OpenRPC spec.

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
