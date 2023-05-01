  /**
   * Getter: ${method.summary}
   * 
${method.params.annotations}${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}  */
  function ${method.name}(): Promise<${method.result.type}>


${method.setter}


${method.subscriber}
