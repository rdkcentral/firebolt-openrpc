  /**
   * ${method.summary}
   * 
   * @param {'${event.name}'} event
   * @param {Function} callback
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}  */
  function listen(event: '${event.name}'${if.context}, ${event.signature.params}${end.if.context}, callback: (data: ${method.result.type}) => void): Promise<number>

  /**
   * ${method.summary}
   * When using `once` the callback method will only fire once, and then disconnect your listener
   * 
   * @param {'${event.name}'} event
   * @param {Function} callback
${if.deprecated}   * @deprecated ${method.deprecation}
${end.if.deprecated}  */
function once(event: '${event.name}'${if.context}, ${event.signature.params}${end.if.context}, callback: (data: ${method.result.type}) => void): Promise<number>
