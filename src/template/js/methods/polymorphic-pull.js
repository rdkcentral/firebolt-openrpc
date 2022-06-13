
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
            data: result
          }
          Transport.send('${info.title}', '${method.name}', params).catch(error => {
            const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
            InternalMetrics.sdk.error(`Failed to send ${method.name} pull response through Transport Layer: ${msg}`, parseInt(error.code) || 500, false, request.parameters)
          })
        }).catch(error => {
          const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
          InternalMetrics.sdk.error(`App '${method.name}' callback failed: ${msg}`, parseInt(error.code) || 500, false, request.parameters)
        })
      }
      catch (error) {
        const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
        InternalMetrics.sdk.error(`App '${method.name}' callback failed: ${msg}`, parseInt(error.code) || 500, false, request.parameters)
    }
    })
  }
  else {
    return Transport.send('${info.title}', '${method.name}', { correlationId: null, data: data })
  }
}