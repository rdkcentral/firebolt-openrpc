import Gateway from "../Gateway/index.mjs"
import Events from "../Events/index.mjs"
import router from "./Router.mjs"

function prop(moduleName, key, params, callbackOrValue = undefined, immutable, readonly, contextParameterCount) {
  const numArgs = Object.values(params).length
  const type = router(params, callbackOrValue, contextParameterCount)

  if (type === "getter") {
    return Gateway.request(moduleName + '.' + key, params)
  }
  else if (type === "subscriber") {
    // subscriber
    if (immutable) {
      throw new Error('Cannot subscribe to an immutable property')
    }
    return Events.listen(moduleName, key + 'Changed', ...Object.values(params), callbackOrValue)
  }
  else if (type === "setter") {
    // setter
    if (immutable) {
      throw new Error('Cannot set a value to an immutable property')
    }
    if (readonly) {
      throw new Error('Cannot set a value to a readonly property')
    }
    return Gateway.request(moduleName + '.set' + key[0].toUpperCase() + key.substring(1), Object.assign({
      value: callbackOrValue
    }, params))
  }
  else if (numArgs < contextParameterCount) {
    throw new Error('Cannot get a value without all required context parameters.')
  }
  else {
    throw new Error('Property accessed with unexpected number of parameters.')
  }
}

export default {
  prop: prop
}