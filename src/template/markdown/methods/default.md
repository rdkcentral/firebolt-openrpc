### ${method.name}

${method.description}

${if.javascript}
```typescript
${method.signature}
```
${end.if.javascript}
${if.params}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

${end.if.params}

Promise resolution:

${method.result}

${if.examples}
**Examples**

${example.title}

${if.javascript}
JavaScript:

```javascript
${example.javascript}
```
Value of `${method.result.name}`:

```javascript
${example.result}
```

${end.if.javascript}

<details>
  <summary>JSON-RPC:</summary>

Request:

```json
${example.jsonrpc}
```

Response:

```json
${example.response}
```

</details>

${end.example}

${end.if.examples}

---
${end.method}
