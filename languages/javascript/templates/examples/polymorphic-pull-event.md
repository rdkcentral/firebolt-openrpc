import { ${module} } from '${package.name}'

let success = await ${module}.${method.pulls.for}(async parameters => {
  console.log(parameters.entityId)
  console.log(parameters.assetId)
  return ${originator.params[1].example.value}
})
console.log(success)