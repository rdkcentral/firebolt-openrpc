import Mock from "../Transport/MockTransport.mjs"

const mocks = {}

function mock(module, method, params, def) {
  const fullMethod = `${module}.${method}`
  if ((params == null) || (Object.values(params).length === 0)) {
    // get
    const rv = mocks[fullMethod] && (mocks[fullMethod].value != null) ? mocks[fullMethod].value : def
    return rv
  } else {
    // set
    let mockMethod = mocks[fullMethod]
    if (mockMethod == null) {
      mockMethod = {
        subscribers: []
      }
    }
    mocks[fullMethod] = mockMethod
    mockMethod.value = params.value
    Mock.event(module, method + 'Changed', {
      value: params[0].value
    })
    return null
  }
}

export default {
  mock: mock
}