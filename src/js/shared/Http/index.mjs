let baseUri
let readyResolver
let ready = new Promise( resolve => readyResolver = resolve )
let proxyProvider = (resource, options) => Promise.resolve({ resource, options })

const join = (...args) => args.map(a => (''+a).split('/')).flat().filter(a => a!=='').join('/').replace(':/', '://')

function setEndpoint(endpoint) {
    baseUri = endpoint
}

function onToken(callback) {
    if (readyResolver) {
        readyResolver(callback)
        readyResolver = null
    }
}

function getToken() {
    return ready.then(tokenGetter => tokenGetter())
}

// this gets called syncrhonously by the SDK itself, if needed
export function proxy(callback) {
    proxyProvider = callback
}

function send(path, method='GET', headers={}, body='', params={}) {

    if (typeof body === 'object' && params === undefined) {
        params = body
        body = undefined
    }

    return new Promise((resolve, reject) => {
        getToken().then(token => {

            Object.assign(headers, {
                'Authorization': token
            })

            const resource = join(baseUri, path) + (params ? '?' + Object.entries(params).map(p => p.join('=')).join('&') : '')
            const options = {
                method,
                headers
            }

            if (method === 'POST' && body) {
                options.body = body
            }

            proxyProvider(resource, options).then( ({ resource, options }) => {
                console.log(`Fetch ${method} ${resource}`)
                options.body && console.log(options.body)

                fetch(resource, options).then(response => {
                    if (response.ok) {
                        response.json().then(json => {
                            resolve(json)
                        }, error => {
                            reject(error)
                        }) 
                    }
                    else {
                        reject(new Error(response.status + ': ' + response.statusText))
                    }
                }).catch(error => {
                    reject(error)
                })
            }).catch(error => {
                reject(error)
            })
        }).catch(error => {
            reject(error)
        })
    })
}

export default {
    send,
    setEndpoint,
    onToken
} 