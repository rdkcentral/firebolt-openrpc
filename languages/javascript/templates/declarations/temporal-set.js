interface ${method.item.type}Process {
   stop(): void
}

  /**
   * Live list: ${method.summary}
   * 
${method.params.annotations}   * @param {Function} add A method for receiving ${method.item.type} objects as they become available
   * @param {Function} remove A method for receiving ${method.item.type} objects as they become unavailable
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}   */
  function ${method.name}(${method.signature.params}${if.context}, ${end.if.context} add: (${method.item}: ${method.item.type}) => void, remove: (${method.item}: ${method.item.type}) => void): ${method.item.type}Process

  /**
   * First match: ${method.summary}
   * 
${method.params.annotations}   * @param {Function} timeout How long, in ms, to wait for a match
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}   */
function ${method.name}(${method.signature.params}${if.context}, ${end.if.context} timeout: number): Promise<${method.item.type}>

  /**
   * Known values w/out updates: ${method.summary}
   * 
${method.params.annotations}
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}   */
function ${method.name}(${method.signature.params}): Promise<${method.item.type}[]>
