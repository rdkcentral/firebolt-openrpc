
function ${method.name}(${method.params}) {
  if (arguments.length === 1 && Array.isArray(arguments[0])) {
    return Transport.send('${info.title}', '${method.name}', arguments[0])
  }
  else {
    return Transport.send('${info.title}', '${method.name}', { ${method.params} })
  }
}