To subscribe to notifications when the value changes, call the method like this:

${if.javascript}

```typescript
function ${method.alternative}(${event.signature.params}${if.context}, ${end.if.context}callback: (value) => ${method.result.type}): Promise<number>
```

${end.if.javascript}

${event.params}

Promise resolution:

```
number
```

#### Examples

${method.examples}