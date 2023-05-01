  /**
   * ${method.summary}
   * 
${method.params.annotations}${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}  */
function ${method.name}(${method.params[1].name}: ${method.params[1].type}): Promise<${method.result.type}>
