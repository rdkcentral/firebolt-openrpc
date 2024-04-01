
function ${method.name}(${method.params.list}) {

  const transforms = ${method.transforms}

  return Gateway.request('${info.title}.${method.name}', { ${method.params.list} }, transforms)
}