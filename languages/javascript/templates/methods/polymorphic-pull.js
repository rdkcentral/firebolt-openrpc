
let ${method.name}HasCallback = false

function ${method.name} (data) {
  if (arguments.length === 1 && typeof arguments[0] === 'function') {
    if (${method.name}HasCallback) {
      return Promise.reject('Cannot register more than one ${method.name} handler.')
    }

    const callback = arguments[0]
    ${method.name}HasCallback = true
    return Events.listen('${info.title}', 'pull${method.Name}', (request) => {
      if (typeof request === 'boolean') return

      try {
        const result = callback(request.parameters).then(result => {
          const params = {
            correlationId: request.correlationId,
            result: result
          }
          Gateway.request('${info.title}.${method.name}', params).catch(error => {
            const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
            console.error(`Failed to send ${method.name} pull response through Transport Layer: ${msg}`)
          })
        }).catch(error => {
          const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
          console.error(`App '${method.name}' callback failed: ${msg}`)
        })
      }
      catch (error) {
        const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
        console.error(`App '${method.name}' callback failed: ${msg}`)
    }
    })
  }
  else {
    return Gateway.request('${info.title}.${method.name}', { correlationId: null, result: data })
  }
}