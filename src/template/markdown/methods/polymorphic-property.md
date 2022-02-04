### ${method.name}
${method.description}

${method.1}

To get the value, call the method with no parameters:

${if.javascript}

```typescript
function ${method.name}(): Promise<${method.result.type}>
```

${end.if.javascript}

Promise resolution:

${method.result}

**Examples**

${example.title}

${if.javascript}
JavaScript:

```javascript
${example.javascript}
```
Value of `value`

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
To set the value, pass in the new value as the only parameter:

${if.javascript}

```typescript
function ${method.name}(${method.params}): Promise<void>
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
    .then(${method.result.name} => {
        // property value has been set
    })
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
To subscribe to notifications when the value changes, pass a function as the only parameter:

${if.javascript}

```typescript
function ${method.name}(subscriber: (${method.params}) => void): Promise<boolean>
```

${end.if.javascript}

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `subscriber` | `Function` | Yes | A callback that gets invoked when the value for ${method.name} changes |

Promise resolution:

| Type | Summary |
| ---- | ------- |
| `listenerId` | The id of the listener that can be used with ${info.title}.clear(listenerId) to unsubscribe |

Callback parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.result.name}` | ${method.result.type} | Yes | ${method.result.summary} ${method.result.constraints} |

**Examples**

${example.title}


${if.javascript}
JavaScript:

```javascript
import { ${module} } from '${package.name}'

${module}.${method.name}(value => {
  // property value was changed
  console.log(value)
}.then(listenerId => {
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
