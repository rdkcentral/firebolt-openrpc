export default function (params, callbackOrValue, contextParameterCount) {
    const numArgs = params ? Object.values(params).length : 0
  
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