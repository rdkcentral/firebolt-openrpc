import EventSession from "../Events/EventSession.mjs"

function start(module, method, addName, removeName, params, add, remove, timeout, transforms) {
    
    if (add && timeout) {
        throw `Error: ${module}.${method} requires either a timeout, or at least one callback because results may be asynchronous.`
    }


    if (add) {
        const events = {}

        events[addName] = {
            callback: add,
            transforms: transforms
        }
    
        events[removeName] = {
            callback: remove,
            transforms: transforms
        }
    
        const { process, promise } = EventSession.start(module, method, params, events, transforms)

        promise.then(result => {
            result.forEach(item => {
                add(item)
            })
        })

        return process
    }
    else if (timeout) {        
        return new Promise( (resolve, reject) => {

            const _timeout = setTimeout(_ => {
                reject()
            }, timeout)

            const events = {}

            events[addName] = {
                callback: (item) => {
                    clearTimeout(_timeout)
                    EventSession.stop(module, method)
                    resolve(item)
                },
                transforms: transforms
            }
            
            const { promise } = EventSession.start(module, method, params, events, transforms)
    
            promise.then(results => {
                if (results.length) {
                    clearTimeout(_timeout)
                    EventSession.stop(module, method)
                    resolve(results.shift())
                }
            }).catch(error => {
                reject(error)
            })
        })
    }
    else {
        return new Promise( (resolve, reject) => {

            const events = {}
            
            const { promise } = EventSession.start(module, method, params, events, transforms)
    
            promise.then(results => {
                if (results.length) {
                    EventSession.stop(module, method)
                    resolve(results)
                }
            }).catch(error => {
                reject(error)
            })
        })
    }
}

export default {
    start: start
}