### ${method.name}

${method.summary}

${if.javascript}
```typescript
function ${method.name}(${method.signature.params}${if.context}, ${end.if.context}add: (${method.item}: ${method.item.type}) => void, remove?: (${method.item}: ${method.item.type}) => void ): Promise<Process>
```
${end.if.javascript}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
${method.params.table.rows}| add                    | `function`           | true                     | Callback to pass any `${method.item.type}` objects to, as they become available |
| remove                 | `function`           | false                    | Callback to pass any `${method.item.type}` objects to, as they become unavailable |

Promise resolution:

```typescript
interface Process {
    stop(): void // Stops updating this temporal set with ${method.item.type} objects
}
```

#### Examples

${method.examples}

---
