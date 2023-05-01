  /**
   * ${method.summary}
   * 
${method.params.annotations}   * @param {Function} add A method for receiving ${method.item.type} objects as they become available${if.deprecated}
   * @deprecated ${method.deprecation}
${end.if.deprecated}   */
  function ${method.name}(${method.signature.params}${if.context}, ${end.if.context} add: (${method.item}: ${method.item.type}) => void): { stop: () => void }

  /**
   * ${method.summary}
   * 
${method.params.annotations}   * @param {Function} add A method for receiving ${method.item.type} objects as they become available
   * @param {Function} remove A method for receiving ${method.item.type} objects as they become unavailable
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}   */
  function ${method.name}(${method.signature.params}${if.context}, ${end.if.context} add: (${method.item}: ${method.item.type}) => void, remove: (${method.item}: ${method.item.type}) => void): { stop: () => void }
