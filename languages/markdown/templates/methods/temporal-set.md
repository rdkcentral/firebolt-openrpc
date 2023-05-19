### ${method.name}

${method.summary}

```typescript
function ${method.name}(${method.signature.params}${if.context}, ${end.if.context}add: (${method.item}: ${method.item.type}) => void, remove?: (${method.item}: ${method.item.type}) => void ): ${method.item.type}Process
```

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
${method.params.table.rows}| add                    | `function`           | true                     | Callback to pass any `${method.item.type}` objects to, as they become available |
| remove                 | `function`           | false                    | Callback to pass any `${method.item.type}` objects to, as they become unavailable |

Returns:

```typescript
interface ${method.item.type}Process {
    stop(): void // Stops updating this temporal set with ${method.item.type} objects
}
```

Additionally, the `${method.name}` method may be called witha `timeout` parameter to find the first match and automatically stop scanning:

```typescript
function ${method.name}(${method.signature.params}${if.context}, ${end.if.context}timeout: number): Promise<${method.item.type}>
```

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
${method.params.table.rows}| timeout                    | `number`           | true                     | How long to wait, in ms, for a match. |

Promise resolution:

```typescript
${method.item.type}
```

#### Examples

${method.examples}

---
