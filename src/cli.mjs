#!/usr/bin/env node

import sdk from '../util/sdk/index.mjs'
import docs from '../util/docs/index.mjs'
import validate from '../util/validate/index.mjs'
import openrpc from '../util/openrpc/index.mjs'
import declarations from '../util/declarations/index.mjs'

const args = process.argv.slice(2)
const util = args.shift()

if (util === 'sdk') {
    sdk(args)
}
else if (util === 'docs') {
    docs(args)
}
else if (util === 'validate') {
    validate(args)
}
else if (util === 'openrpc') {
    openrpc(args)
}
else if (util === 'declarations') {
    declarations(args)
}