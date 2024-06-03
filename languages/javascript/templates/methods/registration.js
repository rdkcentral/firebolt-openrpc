
function ${method.name}(provider) {
    Gateway.provide('${info.title}', provider)
    return Gateway.request('${method.rpc.name}', { enabled: true } )
  }