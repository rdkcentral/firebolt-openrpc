import Server from "../Gateway/Server.mjs"
import router from "./Router.mjs"

const mocks = {}

function mock(module, method, params, value, contextParameterCount, def) {
  const type = router(params, value, contextParameterCount)
  const hash = contextParameterCount ? '.' + Object.keys(params).filter(key => key !== 'value').map(key => params[key]).join('.') : ''
  const key = `${module}.${method}${hash}`

  if (type === "getter") {
    const value = mocks.hasOwnProperty(key) ? mocks[key] : def
    return value
  }
  else if (type === "subscriber") {
  }
  else if (type === "setter") {
    mocks[key] = value
    // notify the app's RPC server directly, w/out a real RPC call
    Server.notify(module + `${method}Changed`, { value })
    return null
  }  
}

export default {
  mock: mock
}