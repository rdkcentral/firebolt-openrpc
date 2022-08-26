import Mock from "../Transport/MockTransport.mjs"

const mocks = {}

function mock(module, method, args, def) {
  const fullMethod = `${module}.${method}`
  if ((args == null) || (Object.values(args).length === 0)) {
    // get
    const rv = mocks[fullMethod] && (mocks[fullMethod].value != null) ? mocks[fullMethod].value : def
    return rv
  } else {
    // set
    console.dir(args, { depth: 100 })
    let mockMethod = mocks[fullMethod]
    if (mockMethod == null) {
      mockMethod = {
        subscribers: []
      }
    }
    mocks[fullMethod] = mockMethod
    mockMethod.value = args.value
    Mock.event(module, method + 'Changed', {
      value: args[0].value
    })
    return null
  }
}

export default {
  mock: mock
}