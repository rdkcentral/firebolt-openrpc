### ${method.name}
${method.description}

${method.1}

To allow the platform to pull data, use `${method.name}(callback)`:

${if.javascript}

```typescript
function ${method.name}(callback: (${method.params}) => Promise<${method.result.type}>): Promise<boolean>
```

${end.if.javascript}

${if.params}

Parameters: 

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `callback` | `function` | Yes | A method the platform will call to pull `${method.name}` data. |

${end.if.params}
Promise resolution:

| Type | Summary |
| ---- | ------- |
| `boolean` | Whether or not the callback registration was successful |

Callback parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

Callback promise resolution:

${method.result}

**Examples**

${example.title}


${if.javascript}
JavaScript:

```javascript
${example.javascript}
```
Value of `success`

```javascript
true
```

${end.if.javascript}

<details>
  <summary>JSON-RPC:</summary>

Request (from callback):

```json
${callback.jsonrpc}
```

Response:

```json
${callback.response}
```

</details>

${end.example}

${method.2}

To push data to the platform, e.g. during app launch, use `${method.name}(${method.params})`:

```typescript
${method.signature}
```

${if.params}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

${end.if.params}

Promise resolution:

${method.result.type}

**Examples**

${example.title}


${if.javascript}
JavaScript:

```javascript
import { ${info.title} } from '${pkg.name}'

${info.title}.${method.name}(${example.params})
```
Value of `${method.result.name}`

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

---
${end.method}
