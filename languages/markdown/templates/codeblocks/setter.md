To set the value of `${method.setter.for}` call the method like this:

${if.javascript}

```typescript
function ${method.setter.for}(${method.signature.params}): Promise<void>
```

${end.if.javascript}

${method.params}

Promise resolution:

${method.result}

#### Examples

${method.examples}