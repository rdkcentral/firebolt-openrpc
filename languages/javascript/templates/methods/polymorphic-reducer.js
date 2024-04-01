
function ${method.name}(${method.params.list}) {
  const transforms = ${method.transforms}

  if (arguments.length === 1 && Array.isArray(arguments[0])) {
    return Gateway.request('${info.title}.${method.name}', arguments[0], transforms)
  }
  else {
    return Gateway.request('${info.title}.${method.name}', { ${method.params.list} }, transforms)
  }
}