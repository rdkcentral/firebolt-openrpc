### ${method.name}
${if.deprecated} 
[Deprecated] This method is deprecated as of ${method.deprecation}. ${if.method.alternative}Please use `${method.alternative}` as a replacement.${end.if.method.alternative}

```typescript
${method.signature}
```
${end.if.deprecated}
${if.not.deprecated}
${method.summary}

```typescript
${method.signature}
```

${method.params}

Promise resolution:

${method.result}

${method.capabilities}

#### Examples

${method.examples}
${end.if.not.deprecated}
---
