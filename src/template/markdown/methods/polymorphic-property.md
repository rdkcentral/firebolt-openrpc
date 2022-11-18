### ${method.name}
${method.description}

${method.1}

To get the value of `${method.name}` call the method like this:

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
${end.method}

${method.2}
To set the value of `${method.name}` call the method like this:

${if.javascript}

```typescript
${method.signature}
```

${end.if.javascript}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

Promise resolution:

| Type | Summary |
| ---- | ------- |
| `void` | Promise resolves with no value when the operation is complete. |

**Examples**

${example.title}


${if.javascript}
JavaScript:

```javascript
import { ${module} } from '${package.name}'

${module}.${method.name}(${example.params})
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
${end.method}

${method.3}
To subscribe to notifications when the value changes, call the method like this:

${if.javascript}

```typescript
function ${method.name} (${method.params} ${if.params}, ${end.if.params}subscriber: (${method.result.name}) => void): Promise<listenerId>
```

${end.if.javascript}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |
| `subscriber`           | `function`             | Yes                      | Callback to execute when the value changes. |


Promise resolution:

| Type | Summary |
| ---- | ------- |
| `listenerId` | The id of the listener that can be used with ${info.title}.clear(listenerId) to unsubscribe |

Callback parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.result.name}` | `${event.result.type}` | Yes | ${method.result.summary} |

**Examples**

${example.title}


${if.javascript}
JavaScript:

```javascript
import { ${module} } from '${package.name}'

${module}.${method.name}(${method.paramNames} ${if.params}, ${end.if.params}(value) => {
  // property value was changed
  console.log(value)
}).then(listenerId => {
  // you can clear this listener w/ ${module}.clear(listenerId)
})
```

value of `value`:

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
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "listening": "true"
  }
}
```

```json
${example.response}
```

</details>

${end.example}

---
${end.method}
