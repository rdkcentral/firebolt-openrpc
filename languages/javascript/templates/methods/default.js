
function ${method.name}(${method.params.list}) {

  const transforms = ${method.transforms}

  let params = { ${method.params.list} }${if.optionalParams}

  // remove the null params if they are optional
  params = Transport.removeNullOptionalParams(params, ${optionalParams})${end.if.optionalParams}

  return Transport.send('${info.title}', '${method.name}', params, transforms)
}