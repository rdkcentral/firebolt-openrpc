import win from '../Transport/global.mjs'
import Transport from '../Transport/index.mjs'

win.__firebolt = win.__firebolt || {}
const initializers = {}
const apis = {}
const queue = {}
const initialized = []
const frozen = false

win.__firebolt.registerExtensionSDK = (id, initializer) => {
    initializers[id] = initializer

    if (queue[id]) {
        initialize(id, queue[id])
        delete queue[id]
    }
}

// Method for handing off platform tokens to extension SDKs
registerAPI('token', _ => Transport.send('authentication', 'token', { type: 'platform' }))

registerAPI('authorize', capability => {
    return new Promise( (resolve, reject) => {

        // this will fail until we support capabilities
        Transport.send('capabilities', 'info', { role: 'use', capabilities: [capability] })
        .then(info => info || [])
        .then(info => info.pop())
        .then(info => {
            if (info.supported && info.available && info.permitted && info.granted) {
                resolve()
            }
            else {
                reject()
            }
        })
        // This is temporary. Will be handled by a user grant policy in future
        .catch(_ => {
            if (capability === 'xrn:firebolt:capabilities:commerce:purchase') {
                Transport.send('profile', 'approvePurchase', {})
                    .then(result => {
                        if (result) {
                            resolve()
                        }
                        else {
                            reject()
                        }
                    })
                    .catch(error => {
                        reject(error)
                    })
            }
        })
    })
})

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

function registerAPI(name, method) {
    apis[name] = method
}

export default {
    initialize,
    active
}