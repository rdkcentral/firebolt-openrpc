let baseUri
const join = (...args) => args.map(a => (''+a).split('/')).flat().filter(a => a!=='').join('/').replace(':/', '://')

function setEndpoint(endpoint) {
    baseUri = endpoint
}

function send(path, method='GET', headers={}, body='', params={}) {
    
    if (typeof body === 'object' && params === undefined) {
        params = body
        body = undefined
    }

    const resource = join(baseUri, path)
    const options = {
        method,
        headers
    }

    console.log(`Fetching ${resource}`)

    return new Promise((resolve, reject) => {
        fetch(resource, options).then(response => {
            if (response.ok) {
                response.json().then(json => {
                    resolve(json)
                }, error => {
                    reject(error)
                }) 
            }
            else {
                resolve({ transactionId: 'abc' })
            }
        }).catch(error => {
            reject(error)
        })
    })
}

export default {
    send,
    setEndpoint
}