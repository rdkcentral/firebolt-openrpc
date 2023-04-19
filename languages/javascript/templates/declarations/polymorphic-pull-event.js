  /**
   * Pull version: ${method.summary}
   * @param {Function} callback A callback method that takes a ${method.pulls.params.type} object and returns a Promise<${method.pulls.type}>
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}  */
  function ${method.pulls.for}(callback: (parameters: ${method.pulls.params.type}) => Promise<${method.pulls.type}>): Promise<boolean>
