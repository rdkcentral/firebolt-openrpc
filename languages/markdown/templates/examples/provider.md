import { ${module} } from '${package.name}'

class MyProvider {
  async ${example.providerMethod}(${method.result.name}, responder) {
    console.log(JSON.stringify(${method.result.name}, null, 2))
    responder(${example.providerResponse})
  }
}

${module}.provide(new MyProvider())