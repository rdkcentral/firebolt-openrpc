import Transport from "../Transport"
import Events from "../Events"

const mocks = {}

function prop(moduleName, key, args, immutable, readonly) {
  if (args.length === 0) {
    // getter
    return Transport.send(moduleName, key)
  } else if (args.length === 1 && typeof args[0] === 'function') {
    // subscribe
    if (immutable) {
      throw new Error('Cannot subscribe to an immutable property')
    }
    return Events.listen(moduleName, key + 'Changed', args[0])
  } else {
    // setter
    if (immutable) {
      throw new Error('Cannot set a value to an immutable property')
    }
    if (readonly) {
      throw new Error('Cannot set a value to a readonly property')
    }
    return Transport.send(moduleName, key, {
      value: args[0]
    })
  }
}

function mock(method, args, def) {
  if ((args == null) || (args.length === 0)) {
    // get
    const rv = mocks[method] && mocks[method].value ? mocks[method].value : def
    return rv
  } else {
    // set
    let mockMethod = mocks[method]
    if (mockMethod == null) {
      mockMethod = {
        subscribers: []
      }
    }
    mocks[method] = mockMethod
    mockMethod.value = args[0].value
    return {}
  }
}

export default {
  prop: prop,
  mock: mock
}