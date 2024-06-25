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

async function start(module, method, addName, removeName, params, add, remove, timeout, transforms) {
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
    
    const results = await Gateway.batch(requests)

    session.add = add
    session.remove = remove
    session.addName = addName
    session.removeName = removeName


    if (add) {
        results[0] && results[0].forEach(item => add(item))

        return {
            stop: () => {
                const requests = [
                    {
                        method: `${module}.stop${method.charAt(0).toUpperCase() + method.substr(1)}`,
                        params: {}
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
                Gateway.batch(requests)
                stopSession(module, method)
            }
        }
    }
    else if (timeout) {
        stopSession(module, method)
        return results[0].shift()
    }
    else {
        stopSession(module, method)
        return Promise.resolve(results[0])
    }
}

export default {
  start: start
}