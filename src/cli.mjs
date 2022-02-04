#!/usr/bin/env node

import sdk from '../util/sdk/index.mjs'
import docs from '../util/docs/index.mjs'
import validate from '../util/validate/index.mjs'
import openrpc from '../util/openrpc/index.mjs'
import declarations from '../util/declarations/index.mjs'
import nopt from 'nopt'
import path from 'path'

const knownOpts = {
  'task': [String, null],
  'source': [path],
  'template': [path],
  'output': [path],
  'shared-schemas': [path],
  'as-path': Boolean,
  'static-modules': String
}
const shortHands = {
  't': '--task',
  's': '--source',
  'tm': '--template',
  'tm': '--template',
  'o': '--output',
  'ap': '--as-path',
  'sm': '--static-modules',
  'ss': '--shared-schemas'
}
// Last 2 arguments are the defaults.
const parsedArgs = nopt(knownOpts, shortHands, process.argv, 2)

const util = parsedArgs.task

if (util === 'sdk') {
    sdk(parsedArgs)
}
else if (util === 'docs') {
    docs(parsedArgs)
}
else if (util === 'validate') {
    validate(parsedArgs)
}
else if (util === 'openrpc') {
    openrpc(parsedArgs)
}
else if (util === 'declarations') {
    declarations(parsedArgs)
} else {
  console.log("Invalid build type")
}