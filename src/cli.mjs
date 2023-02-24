#!/usr/bin/env node

import slice from './slice/index.mjs'
import sdk from './sdk/index.mjs'
import docs from './docs/index.mjs'
import openrpc from './openrpc/index.mjs'
import declarations from './declarations/index.mjs'
import validate from './validate/index.mjs'

import nopt from 'nopt'
import path from 'path'

const knownOpts = {
  'task': [String, null],
  'input': [path],
  'output': [path],
  'sdk': [path],
  'schemas': [path, Array],
  'template': [path],
  'static-module': [String, Array],
}

const shortHands = {
  't': '--task',
  'i': '--input',
  'o': '--output',
  's': '--schemas'
}

// Last 2 arguments are the defaults.
const parsedArgs = nopt(knownOpts, shortHands, process.argv, 3)
const task = process.argv[2]
const signOff = () => console.log('\nThis has been a presentation of \x1b[38;5;202mFirebolt\x1b[0m \u{1F525} \u{1F529}\n')

if (task === 'slice') {
  slice(parsedArgs).then(signOff)
}
else if (task === 'sdk') {
    sdk(parsedArgs).then(signOff)
}
else if (task === 'docs') {
    docs(parsedArgs).then(signOff)
}
else if (task === 'validate') {
    validate(parsedArgs).then(signOff)
}
else if (task === 'openrpc') {
    openrpc(parsedArgs).then(signOff)
}
else if (task === 'declarations') {
    declarations(parsedArgs).then(signOff)
} else {
  console.log("Invalid build type")
}