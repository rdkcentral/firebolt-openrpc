import { ${module} } from '${package.name}'

${module}.${method.pulls.for}(function(parameters) {
  console.log(parameters.entityId)
  console.log(parameters.assetId)
  return Promise.resolve(${originator.params[1].example.value})
}).then(success => {
  console.log(success)
})