### ${method.name}
${method.description}

${if.javascript}
```typescript
${method.signature}
```
${end.if.javascript}
${if.params}

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

${end.if.params}

#### Promise Resolution

${method.result}

---

#### Examples

##### ${example.title}
${example.summary}

${if.javascript}
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${example.javascript}
```
Value of `${method.result.name}`

```javascript
${example.result}
```

</details>
${end.if.javascript}

<details>
  <summary><b>JSON-RPC</b></summary>

###### Request

```json
${example.jsonrpc}
```

###### Response

```json
${example.response}
```

</details>

${end.example}


---
${end.method}
