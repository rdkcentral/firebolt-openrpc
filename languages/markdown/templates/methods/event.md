### ${event.name}

${if.javascript}
```typescript
function listen('${event.name}', ${event.signature.params}${if.context}, ${end.if.context}(${event.result.type}) => void): Promise<number>
```
See also: [listen()](#listen), [once()](#listen), [clear()](#listen).

${end.if.javascript}

${event.params}

Event value:

${method.result}

${method.capabilities}

#### Examples

${method.examples}

---
