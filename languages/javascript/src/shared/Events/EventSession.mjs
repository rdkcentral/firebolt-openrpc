import Transport from "../Transport/index.mjs"
import Events from "../Events/index.mjs"

const sessions = {}

let eventEmitterInitialized = false

const eventHandler = (id, value) => {
    const key = JSON.stringify(id)
    const session = Object.values(sessions).find(session => Object.keys(session.listeners).includes(key))
    if (session.overseer) {
        console.dir(session, { depth: 10 })
        console.dir(key)
        const event = Object.entries(session.eventIds).find(([name, value]) => value === key)
        if (event) {
            session.overseer(event[0], value)
        }
    }
    session.listeners[key](value)
}

function getSession(module, method) {
    return sessions[module.toLowerCase() + '.' + method]
}

function startSession(module, method) {
    const session = {
        listeners: {},
        queues: {},
        eventIds: {}
    }
    sessions[module.toLowerCase() + '.' + method] = session
    return session
}

function stopSession(module, method) {
    delete sessions[module.toLowerCase() + '.' + method]
}

function start(module, method, params, events, transforms, fyi) {
    let session = getSession(module, method)

    if (!eventEmitterInitialized) {
        Transport.addEventEmitter(eventHandler)
        eventEmitterInitialized = true
    }

    if (session) {
        throw `Error: only one ${module}.${method} operation may be in progress at a time. Call stop${method.charAt(0).toUpperCase() + method.substr(1)} on previous ${method} first.`
    }
    else {
        session = startSession(module, method)
    }

    session.overseer = fyi

    const requests = [
        {
            module: module,
            method: method,
            params: params,
            transforms: transforms
        },
        {
            module: module,
            method: `on${method.charAt(0).toUpperCase() + method.substring(1)}Error`,
            params: {
                listen: true
            }
        }
    ]

    requests.push(...Object.entries(events).map(([event, data]) => ({
        module: module,
        method: event,
        params: {
            listen: true
        },
        transforms: data.transforms
    })))

    const results = Transport.send(requests)

    session.id = results[0].id

    const process = {
        stop: () => {
            const requests = [
                {
                    module: module,
                    method: `stop${method.charAt(0).toUpperCase() + method.substr(1)}`,
                    params: {
                        correlationId: session.id
                    }
                }
            ]

            requests.push(...Object.entries(events).map(([event, data]) => ({
                module: module,
                method: event,
                params: {
                    listen: false
                }
            })))            

            console.dir(requests, { depth: 10})
            Transport.send(requests)
            stopSession(module, method)
        },

        onError: (callback) => {
            if (callback) {
                session.listeners[JSON.stringify(results[1].id)] = callback
                while (session.queues[JSON.stringify(results[1].id)].length) {
                    callback(session.queues[JSON.stringify(results[1].id)].shift())
                }
            }
            else {
                throw `onError() requires a callback`
            }
        }
    }

    session.queues[JSON.stringify(results[1].id)] = []
    session.listeners[JSON.stringify(results[1].id)] = (item) => session.queues[JSON.stringify(results[1].id)].push(item)

    // wire up additional callbacks or queues (not errors)
    for (var i=2; i<results.length; i++) {
        session.eventIds[Object.keys(events)[i-2]] = JSON.stringify(results[i].id)
        // if callback available, set it up and skip queue
        if (Object.values(events)[i-2].callback) {
            session.listeners[JSON.stringify(results[i].id)] = Object.values(events)[i-2].callback
        }
        // otherwise wire up a queue and a subscriber
        else {
            session.queues[JSON.stringify(results[i].id)] = []
            session.listeners[JSON.stringify(results[i].id)] = (item) => session.queues[JSON.stringify(results[i].id)].push(item)
            const name = Object.values(events)[i-2].subscriber || Object.keys(events)[i-2]
            const id = results[i].id
            process[name] = (callback) => {
                if (callback) {
                    session.listeners[JSON.stringify(id)] = callback
                    while (session.queues[JSON.stringify(id)].length) {
                        callback(session.queues[JSON.stringify(id)].shift())
                    }
                }
                else {
                    throw `${name}() requires a callback`
                }
            }            
        }
    }

    return { process, promise: results[0].promise }
}

function stop(module, method) {
    stopSession(module, method)
}

function dispatch(module, method, event, value) {
    const session = getSession(module, method)

    if (session) {
        session.listeners[session.eventIds[event]](value)
    }
}

export default {
    start: start,
    stop: stop,
    dispatch: dispatch
}