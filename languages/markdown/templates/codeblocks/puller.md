```typescript
function ${method.pulls.for}(callback: (parameters: ${method.pulls.type}Parameters) => Promise<${method.pulls.type}Result>): Promise<boolean>
```

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `callback` | `Function` | Yes | A callback for the platform to pull ${method.pulls.type} objects |

Callback parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `parameters` | `${method.pulls.type}Parameters` | Yes | An object describing the platform's query for an `${method.pulls.for}` object. |

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
