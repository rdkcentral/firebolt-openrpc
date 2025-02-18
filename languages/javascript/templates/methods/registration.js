
function ${method.name}(provider) {
  Gateway.provide('${method.interface}', provider)
  return Gateway.request('${info.title}.${method.rpc.name}', { enabled: true } )
}