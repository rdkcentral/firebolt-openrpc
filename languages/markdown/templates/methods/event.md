### ${event.name}

${if.deprecated}
[Deprecated] This method is deprecated as of ${method.deprecation}. ${if.method.alternative}Please use `${method.alternative}` as a replacement.${end.if.method.alternative}
${end.if.deprecated}

${if.not.deprecated}

```typescript
function listen('${event.name}', ${event.signature.params}${if.context}, ${end.if.context}(${event.result.type}) => void): Promise<number>
```
See also: [listen()](#listen), [once()](#listen), [clear()](#listen).

${event.params}

Event value:

${method.result}

${method.capabilities}

#### Examples

${method.examples}
${end.if.not.deprecated}
---
