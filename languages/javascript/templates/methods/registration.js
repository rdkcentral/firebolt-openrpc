
function ${method.name}(provider) {
    Gateway.provide('${method.interface}', provider)
    return Gateway.request('${method.rpc.name}', { enabled: true } )
  }