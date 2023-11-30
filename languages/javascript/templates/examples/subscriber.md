import { ${module} } from '${package.name}'

let listenerId = await ${method.alternative}(value => {
  console.log(value)
})
console.log(listenerId)