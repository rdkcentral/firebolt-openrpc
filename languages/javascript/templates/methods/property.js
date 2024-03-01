function ${method.name}(${method.params.list}) {
  let callbackOrValue = arguments[${method.params.count}]
  let params = { ${method.params.list} }
  
  // x-subscriber-type: global
  if (arguments.length === 1 && (typeof arguments[0] === 'function')) {
    callbackOrValue = arguments[0]
    params = {}
  }
  
  return Prop.prop('${info.title}',  '${method.name}', params, callbackOrValue, ${method.property.immutable}, ${method.property.readonly}, ${method.params.count})
}