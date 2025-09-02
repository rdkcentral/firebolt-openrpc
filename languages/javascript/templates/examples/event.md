import { ${module} } from '${package.name}'

// The listenerId is a numeric value that can be used to unsubscribe from the event if necessary.
let listenerId = await ${module}.listen('${event.name}', ${method.result.name} => {
  console.log(${method.result.name})
})
