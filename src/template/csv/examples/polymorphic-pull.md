${module}.${method.name}(function(parameters) {
  return Promise.resolve(${example.result})
}).then(success => {
  console.log(success)
})