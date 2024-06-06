#!/usr/bin/env node

import slice from './slice/index.mjs'
import sdk from './sdk/index.mjs'
import docs from './docs/index.mjs'
import openrpc from './openrpc/index.mjs'
import validate from './validate/index.mjs'
import update from './update/index.mjs'

import nopt from 'nopt'
import path from 'path'
import url from 'url'

const knownOpts = {
  'input': [path],
  'output': [path],
  'client': [path],
  'server': [path],
  'sdk': [path],
  'schemas': [path, Array],
  'template': [path],
  'static-module': [String, Array],
  'copy-schemas': [Boolean],
  'language': [path],
  'examples': [path, Array],
  'as-path': [Boolean],
  'bidirectional': [Boolean]
}

const shortHands = {
  'i': '--input',
  'o': '--output',
  's': '--schemas',
  'l': '--language',
  'e': '--examples',
  'p': '--as-path'
}

// Workaround for using __dirname in ESM
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
const javascript = path.join(__dirname, '..', 'languages', 'javascript')
const jsonrpc = path.join(__dirname, '..', 'languages', 'jsonrpc')
const markdown = path.join(__dirname, '..', 'languages', 'markdown')

const defaults = {
  language: process.argv[2] === 'docs' ? markdown : javascript,
  examples: process.argv[2] === 'docs' ? [ javascript, jsonrpc ] : undefined
}

// Parse the arguments and merge with the defaults
// Ignore args: 0 (node), 1 (cli.mjs), and 2 (the task name, which has no --option in front of it)
const parsedArgs = Object.assign({}, defaults, nopt(knownOpts, shortHands, process.argv, 3))
const task = process.argv[2]
const signOff = () => console.log('\nThis has been a presentation of \x1b[38;5;202mFirebolt\x1b[0m \u{1F525} \u{1F529}\n')

try {
  if (task === 'slice') {
    await slice(parsedArgs).then(signOff)
  }
  else if (task === 'sdk') {
    await sdk(parsedArgs).then(signOff)
  }
  else if (task === 'docs') {
    await docs(parsedArgs).then(signOff)
  }
  else if (task === 'validate') {
    await validate(parsedArgs).then(signOff)
  }
  else if (task === 'openrpc') {
    await openrpc(parsedArgs).then(signOff)
  }
  else if (task === 'update') {
    await update(parsedArgs).then(signOff)
  }
  else {
    console.log("Invalid build type")
  }
}
catch (error) {
  throw error
}