import { ${module} } from '${package.name}'

let listenerId = await ${module}.listen('${event.name}', ${method.result.name} => {
  console.log(${method.result.name})
})