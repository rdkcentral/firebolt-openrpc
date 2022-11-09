import Transport from '../Transport/index.mjs'

window.__firebolt = window.__firebolt || {}
const initializers = {}
const apis = {}
const queue = {}
const initialized = []
const pending = []
const frozen = false
const getDistributor = Transport.send('device', 'distributor', {})

window.__firebolt.registerExtensionSDK = (id, initializer) => {
    initializers[id] = initializer

    if (queue[id]) {
        initialize(id, queue[id])
        delete queue[id]
    }
}

// Method for handing off platform tokens to extension SDKs
registerAPI('authorize', (...args) => Transport.send('capabilities', 'authorize', {...args} ))

function initialize(id, config) {
    if (!frozen) {
        Object.freeze(apis)
    }
    Object.freeze(config)
    if (initializers[id]) {
        const getEndPoint = Transport.send('capabilities', 'endpoint', { id })
        const init = initializers[id]
        delete initializers[id]
        pending.push(id)
        Promise.all([getDistributor, getEndPoint]).then( ([distributor, endpoint]) => {
            init(distributor, endpoint, config, apis)
            initialized.push(id)
            delete pending[id]
        })
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