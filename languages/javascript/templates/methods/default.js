
function ${method.name}(${method.params.list}) {

  const transforms = ${method.transforms}

  let params = { ${method.params.list} }

  // remove the null params if they are optional
  ${if.optionalParams}params = Transport.removeNullOptionalParams(params, ${optionalParams})${end.if.optionalParams}

  return Transport.send('${info.title}', '${method.name}', params, transforms)
}