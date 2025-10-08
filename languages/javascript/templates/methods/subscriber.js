// ${method.name} is accessed via listen('${event.name}, ...)
${if.context}
registerEventContext('${info.title}', '${event.name}', ${method.context.array})${end.if.context}