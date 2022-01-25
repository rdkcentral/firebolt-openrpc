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

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `callback` | `function` | Yes | A method the platform will call to pull `${method.name}` data. |

${end.if.params}
#### Promise Resolution

| Type | Summary |
| ---- | ------- |
| `boolean` | Whether or not the callback registration was successful |

#### Callback Parameters
| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

#### Callback Promise Resolution

${method.result}

#### Examples

##### ${example.title}
${example.summary}

${if.javascript}
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${example.javascript}
```
Value of `success`

```javascript
true
```

</details>
${end.if.javascript}

<details>
  <summary><b>JSON-RPC</b></summary>

###### Request (from callback)

```json
${callback.jsonrpc}
```

###### Response

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

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

${end.if.params}

#### Promise Resolution

${method.result.type}

#### Examples

##### ${example.title}
${example.summary}

${if.javascript}
<details>
  <summary><b>JavaScript</b></summary>

```javascript
import { ${info.title} } from '${pkg.name}'

${info.title}.${method.name}(${example.params})
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
