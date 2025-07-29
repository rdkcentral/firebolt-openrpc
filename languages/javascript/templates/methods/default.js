
function ${method.name}(${method.params.list}) {

  let params = { ${method.params.list} }${if.optionalParams}

  // remove the null params if they are optional
  params = Gateway.removeNullOptionalParams(params, ${optionalParams})${end.if.optionalParams}

  return Gateway.request('${info.title}.${method.name}', params)${if.method.transform}${method.transform}${end.if.method.transform}
}