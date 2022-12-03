let baseUri

let authApiResolver
let authApiReady = new Promise( resolve => authApiResolver = resolve )


let proxyProvider = (resource, options) => Promise.resolve({ resource, options })

const join = (...args) => args.map(a => (''+a).split('/')).flat().filter(a => a!=='').join('/').replace(':/', '://')

function setEndpoint(endpoint) {
    baseUri = endpoint
}

function onAuthorize(callback) {
    if (authApiResolver) {
        authApiResolver(callback)
        authApiResolver = null
    }
}

function getAuthorization(grants) {
    return authApiReady.then(authGetter => authGetter(grants))
}


// this gets called syncrhonously by the SDK itself, if needed
export function proxy(callback) {
    proxyProvider = callback
}

function send(module, method, params, http = {}) {

    let path = http.path || `/${module}/${method}`
    const headers = http.headers || {}
    const body = params && JSON.stringify(params) || null
    let query = http.parameters || ''
    
    Object.entries(params).forEach(([name, value]) => {
        const re = new RegExp('\\${param.' + name + '}', 'g')
        path = path.replace(re, value)
        query = query.replace(re, value)
        Object.keys(headers).forEach(header => {
            headers[header] = headers[header].replace(re, value)
        })
    })

    return new Promise((resolve, reject) => {
        const requested = http.uses.map(capability => ({ role: 'use', capability }))
                  .concat(http.manages.map(capability => ({ role: 'manage', capability })))
                  .concat(http.provides.map(capability => ({ role: 'provide', capability })))

        getAuthorization(requested).then((token) => {
            // TODO: this could be a bit more robust...
            Object.assign(headers, {
                'Authorization': token
            })

            const resource = join(baseUri, path) + (query ? '?' + query : '')
            const options = {
                method: http.method || 'GET',
                headers: headers
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
    onAuthorize
} 