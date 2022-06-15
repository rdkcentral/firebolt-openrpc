import Transport from "../Transport/index.mjs"
import Events from "../Events/index.mjs"

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
    return Transport.send(moduleName, 'set' + key[0].toUpperCase() + key.substring(1), {
      value: args[0]
    })
  }
}

export default {
  prop: prop
}