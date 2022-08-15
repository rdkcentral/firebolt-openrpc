import Transport from '../Transport/index.mjs'

window.__firebolt = window.__firebolt || {}
const initializers = {}
const apis = {}
const queue = {}
const initialized = []
const frozen = false

window.__firebolt.registerExtensionSDK = (id, initializer) => {
    initializers[id] = initializer

    if (queue[id]) {
        initialize(id, queue[id])
        delete queue[id]
    }
}

registerAPI('token', _ => Transport.send('authentication', 'token', { type: 'platform' }))
registerAPI('authorize', grants => Transport.send('capabilities', 'request', {grants} ))

function initialize(id, config) {
    if (!frozen) {
        Object.freeze(apis)
    }
    Object.freeze(config)
    if (initializers[id]) {
        initializers[id](config, apis)
        delete initializers[id]
        initialized.push(id)
    }
    else {
        queue[id] = config
    }
}

function active() {
    return Object.freeze(initialized.contact())
}

export function registerAPI(name, method) {
    apis[name] = method
}

export default {
    initialize,
    active
}