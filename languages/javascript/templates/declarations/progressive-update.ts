interface ${method.Name}Process {
    stop(): void;
    onProgress(callback: (status: ${method.Name}Status) => void): void;
    onComplete(callback: (data: ${method.result.type}) => void): void;
    onStop(callback: (status: ${method.Name}Status) => void): void;
    onError(callback: (error: ${method.Name}Error) => void): void;
 }

/**
  * ${method.summary}
  * 
${method.params.annotations}
${if.deprecated}  * @deprecated ${method.deprecation}
${end.if.deprecated}  */
  function ${method.name}(${method.signature.params}): ${method.Name}Process
 