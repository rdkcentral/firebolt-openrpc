---
title: Firebolt OpenRPC Tools
---
# Firebolt OpenRPC Tools
Tools to enable consistent Firebolt SDK generation.

## To Use

  - First, `npm install`.
  - Next, invoke the cli directly with `src/cli.js`. See below for arguments.

## CLI Arguments

`--task`: Tell the tool what you want it to do. `sdk|docs|openrpc|validate`. More on each below.

`--source`: The relative or absolute path to the folder or file that the task will use.

`--template`: The relative or absolute path to the folder or file containing template resources for the task.

`--output`: The relative or absolute path to the folder or file that will hold the task's generated output.

`--as-path`: I'm not sure what this does.

`--static-modules`: Makes sure that statically defined modules get exported. An example is `Platform`.

### SDK Generation

Indicated by `--task sdk`. Generate the Firebolt JavaScript SDK from a json-rpc spec.

### Document Generation

Indicated by `--task docs`.

### OpenRPC Generation

Indicated by `--task openrpc`. Reads a spec for a json-rpc API and generates an openrpc document for it.

### JSON-RPC Validation

Indicated by `--task validate`. Reads a json-rpc spec and validates it.

## CLI Shorthands

Don't feel like typing? Use `-t` instead of `--task`. This object shows the mapping:

```js
const shortHands = {
  't': '--task',
  's': '--source',
  'tm': '--template',
  'o': '--output',
  'ap': '--as-path',
  'sm': '--static-modules'
}
```
