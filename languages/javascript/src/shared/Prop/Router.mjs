export default function (params, callbackOrValue, contextParameterCount) {
    const numArgs = Object.values(params).length
  
    if (numArgs === contextParameterCount && callbackOrValue === undefined) {
      // getter
      return "getter"
    } else if (numArgs === contextParameterCount && typeof callbackOrValue === 'function') {
      // subscribe
      return "subscriber"
    } else if (numArgs === (contextParameterCount) && callbackOrValue !== undefined) {
      // setter
      return "setter"
    }

    return null
}