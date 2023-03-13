function ${method.name}(${method.params.list}) {
  const callbackOrValue = arguments[${method.params.count}]
  return Prop.prop('${info.title}',  '${method.name}', { ${method.params} }, callbackOrValue, ${method.property.immutable}, ${method.property.readonly}, ${method.params.count})
}