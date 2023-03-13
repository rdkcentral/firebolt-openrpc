
function ${method.name}(${method.params.list}) {
  const transforms = ${method.transforms}

  if (arguments.length === 1 && Array.isArray(arguments[0])) {
    return Transport.send('${info.title}', '${method.name}', arguments[0], transforms)
  }
  else {
    return Transport.send('${info.title}', '${method.name}', { ${method.params.list} }, transforms)
  }
}