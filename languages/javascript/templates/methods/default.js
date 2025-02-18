
function ${method.name}(${method.params.list}) {
  return Gateway.request('${info.title}.${method.name}', { ${method.params.list} })${if.method.transform}${method.transform}${end.if.method.transform}
}