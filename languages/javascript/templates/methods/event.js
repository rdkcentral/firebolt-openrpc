// ${method.name} is accessed via listen('${event.name}, ...)
${if.context}
registerEventContext('${info.title}', '${event.name}', ${method.context.array})${end.if.context}
${if.transforms}
registerEventTransform('${info.title}', '${event.name}', ${method.transforms})${end.if.transforms}