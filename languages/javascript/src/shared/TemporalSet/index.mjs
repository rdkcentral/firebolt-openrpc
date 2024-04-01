import Gateway from "../Gateway/index.mjs"

const sessions = {}

function getSession(module, method) {
    return sessions[module.toLowerCase() + '.' + method]
}

function startSession(module, method) {
    sessions[module.toLowerCase() + '.' + method] = {}
    return sessions[module.toLowerCase() + '.' + method]
}

function stopSession(module, method) {
    delete sessions[module.toLowerCase() + '.' + method]
}

function start(module, method, addName, removeName, params, add, remove, timeout, transforms) {
    let session = getSession(module, method)

    if (session) {
        throw `Error: only one ${module}.${method} operation may be in progress at a time. Call stop${method.charAt(0).toUpperCase() + method.substr(1)} on previous ${method} first.`
    }
    else {
        session = startSession(module, method)
    }

    if (add && timeout) {
        throw `Error: ${module}.${method} requires either a timeout, or at least one callback because results may be asynchronous.`
    }

    const requests = [
        {
            method: `${module}.${method}`,
            params: params,
            transforms: transforms
        }
    ]

    requests.push({
        method: `${module}.${addName}`,
        params: {
            listen: true
        },
        transforms: transforms
    })

    Gateway.subscribe(`${module}.${addName}`, (item) => {
        session.add(item)
    })

    if (remove) {
        requests.push({
            method: `${module}.${removeName}`,
            params: {
                listen: true
            },
            transforms: transforms
        })
        Gateway.subscribe(`${module}.${removeName}`, (item) => {
            session.remove(item)
        })    
    }
    
    const results = Gateway.request(requests)

    session.id = results[0].id
    session.add = add
    session.remove = remove
    session.addName = addName
    session.removeName = removeName

    results[0].promise.then( items => {
        add && items && items.forEach(item => add(item))
    })

    if (add) {
        return {
            stop: () => {
                const requests = [
                    {
                        method: `${module}.stop${method.charAt(0).toUpperCase() + method.substr(1)}`,
                        params: {
                            correlationId: session.id
                        }
                    },
                    {
                        method: `${module}.${addName}`,
                        params: {
                            listen: false
                        }
                    }
                ]

                Gateway.unsubscribe(`${module}.${addName}`)

                if (remove) {
                    requests.push({
                        method: `${module}.${removeName}`,
                        params: {
                            listen: false
                        }
                    })
                }
                
                Gateway.unsubscribe(`${module}.${removeName}`)
                Gateway.request(requests)
                stopSession(module, method)
            }
        }
    }
    else if (timeout) {
        return results[0].promise.then(results => {
            stopSession(module, method)
            return results.shift()
        })
    }
    else {
        return results[0].promise.then(results => {
            stopSession(module, method)
            return results
        })
    }
}

export default {
  start: start
}