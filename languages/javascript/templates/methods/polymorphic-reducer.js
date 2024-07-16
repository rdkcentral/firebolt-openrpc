
function ${method.name}(${method.params.list}) {
  if (arguments.length === 1 && Array.isArray(arguments[0])) {
    return Gateway.request('${info.title}.${method.name}', arguments[0])${method.transform}
  }
  else {
    return Gateway.request('${info.title}.${method.name}', { ${method.params.list} })${method.transform}
  }
}