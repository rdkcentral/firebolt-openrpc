import EventSession from "../Events/EventSession.mjs"

function start(module, method, params, progressName, completeName, stopName, transforms) {
    const events = {}
    events[progressName] = {
        subscriber: 'onProgress'
    }
    events[completeName] = {
        subscriber: 'onComplete'
    }

    events[stopName] = {
        subscriber: 'onStop'
    }

    const { process, promise } = EventSession.start(module, method, params, events, transforms, (event, value) => {
        console.dir(event)
        if (event === completeName) {
            EventSession.stop(module, method)
        }
    })

    promise.then(result => {
        // dispatch the 0% progress event w/ the initial result
        EventSession.dispatch(module, method, progressName, {
            progress: 0,
            data: result
        })
    })

    return process
}

export default {
    start: start
}