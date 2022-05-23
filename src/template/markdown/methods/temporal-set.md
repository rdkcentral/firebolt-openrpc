### ${method.name}

${method.description}

${if.javascript}
```typescript
function ${method.name}(${method.params}${method.extraParams}): Promise<Process>
```
${end.if.javascript}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |
| add                    | `function`           | true                     | Callback to pass any `${method.result.type}` objects to, as they become available |
| remove                 | `function`           | false                    | Callback to pass any `${method.result.type}` objects to, as they become unavailable |


Promise resolution:

```typescript
interface Process {
    stop(): void // Stops updating this temporal set with ${method.result.type} objects
}
```


${if.examples}
**Examples**

${example.title}

${if.javascript}
JavaScript:

```javascript
${example.javascript}
```
Value of `${method.item}`:

```javascript
${example.result}
```

${end.if.javascript}

<details>
  <summary>JSON-RPC:</summary>

Request:

```json
[
    ${example.jsonrpc},
    {
        "id": 2,
        "method": "on${method.item}Available",
        "params": {
            "listen": true
        }
    }
]
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
