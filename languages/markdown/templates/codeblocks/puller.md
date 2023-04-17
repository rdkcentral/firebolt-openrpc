```typescript
function ${method.pulls.for}(callback: (parameters: ${method.pulls.params.type}) => Promise<${method.pulls.type}>): Promise<boolean>
```

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `callback` | `Function` | Yes | A callback for the platform to pull ${method.pulls.type} objects |

Callback parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `parameters` | `${method.pulls.params.type}` | Yes | An object describing the platform's query for an `${method.pulls.type}` object. |

```typescript
${method.pulls.params}
```

Callback promise resolution:

```typescript
${method.pulls.result}
```

${method.seeAlso}

#### Examples

${method.examples}
