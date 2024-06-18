${interface}

${if.unidirectional}
function provide(capability: '${capability}', provider: ${provider} | object): Promise<void>
${end.if.unidirectional}