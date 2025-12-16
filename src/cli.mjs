#!/usr/bin/env node

import slice from './slice/index.mjs'
import sdk from './sdk/index.mjs'
import docs from './docs/index.mjs'
import openrpc from './openrpc/index.mjs'
import validate from './validate/index.mjs'

import nopt from 'nopt'
import path from 'path'
import url from 'url'

const knownOpts = {
  'input': [path],
  'output': [path],
  'appApi': [path],
  'platformApi': [path],
  'sdk': [path],
  'schemas': [path, Array],
  'template': [path],
  'static-module': [String, Array],
  'language': [path],
  'config-file-override': [path],
  'examples': [path, Array],
  'as-path': [Boolean],
  'bidirectional': [Boolean],
  'pass-throughs': [Boolean]
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
const noptResult = nopt(knownOpts, shortHands, process.argv, 3)

if (noptResult['config-file-override']) {
  defaults.config = noptResult['config-file-override']
}

const parsedArgs = Object.assign({}, defaults, noptResult)
const task = process.argv[2]

try {
  console.log(`Starting task '${task}'\n`);
  switch(task) {
    case 'slice':
      await slice(parsedArgs);
      break;
    case 'sdk':
      await sdk(parsedArgs);
      break;
    case 'docs':  
      await docs(parsedArgs);
      break;
    case 'validate':
      await validate(parsedArgs);
      break;
    case 'openrpc':
      await openrpc(parsedArgs);
      break;
    default:
      console.log('Invalid task: ' + task);
  }
  console.log(`\nTask '${task}' has finished\n`);
} catch (error) {
  console.dir(error)
  throw error
}
