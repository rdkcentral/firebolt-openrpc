### ${method.name}
${method.description}

${method.1}

To get the property value, use `${method.name}()`:

${if.javascript}

```typescript
function ${method.name}(): Promise<${method.result.type}>
```

${end.if.javascript}

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |

#### Promise Resolution

| Type | Summary |
| ---- | ------- |
| ${method.result.type} | ${method.result.summary} |

#### Examples

##### ${example.title}
${example.summary}

${if.javascript}
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${example.javascript}
```
Value of `value`

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
${end.method}

${method.2}
To set the property value, use `${method.name}(value)`:

${if.javascript}

```typescript
function ${method.name}(${method.params}): Promise<${method.result.type}>
```

${end.if.javascript}

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

#### Promise Resolution

| Type | Summary |
| ---- | ------- |

#### Examples

##### ${example.title}
${example.summary}

${if.javascript}
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${example.javascript}
```
Value of `response`

```javascript
{}
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
${end.method}

${method.3}
To subscribe to the property value, use `${method.name}(value => { })`:

${if.javascript}

```typescript
function ${method.name}(callback: (${method.params}) => any): Promise<boolean>
```

${end.if.javascript}

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `callback` | `function` | Yes | A callback that gets invoked when the value for ${method.name} changes |

#### Promise Resolution

| Type | Summary |
| ---- | ------- |
| `listenerId` | The id of the listener that can be used with ${info.title}.clear(listenerId) to unsubscribe |

#### Callback Parameters
| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

#### Examples

##### ${example.title}
${example.summary}

${if.javascript}
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${example.javascript}
```
Value of `response`

```javascript
{}
```
Value of `value`

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
${end.method}
