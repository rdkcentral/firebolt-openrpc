#### ${method.name}

${method.description}

```typescript
${method.signature}
```

Provider methods always have two arguments:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |


${if.provider.params}

| Parameters Property    | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${provider.param.name}` | ${provider.param.type} | ${provider.param.required} | ${provider.param.summary} ${provider.param.constraints} |

```typescript
${parameters.shape}
```

${end.if.provider.params}

Promise resolution:

${method.result}
