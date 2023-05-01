
function ${method.name}(${method.params.list}) {

  const transforms = ${method.transforms}

  return Transport.send('${info.title}', '${method.name}', { ${method.params.list} }, transforms)
}