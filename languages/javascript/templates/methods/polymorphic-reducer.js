
function ${method.name}(${method.params.list}) {
  if (arguments.length === 1 && Array.isArray(arguments[0])) {
    return Gateway.request('${info.title}.${method.name}', arguments[0])${if.method.transform}${method.transform}${end.if.method.transform}
  }
  else {
    return Gateway.request('${info.title}.${method.name}', { ${method.params.list} })${if.method.transform}${method.transform}${end.if.method.transform}
  }
}