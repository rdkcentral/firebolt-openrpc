
function ${method.name}(${method.params}) {

  const transforms = ${method.transforms}

  return Transport.send('${info.title}', '${method.name}', { ${method.params} }, transforms)
}