### ${event.name}
${method.summary}

${if.javascript}
```typescript
// listen to ${event.name}
${info.title}.listen('${event.name}', (data: ${method.result.type}) => void): Promise<bigint>

// listen to ${event.name} once
${info.title}.once('${event.name}', (data: ${method.result.type}) => void): Promise<bigint>

// clear a listener
${info.title}.clear(listenerId?: bigint): void

```
${end.if.javascript}

${if.resultcomplex}
#### Event value

${method.result}

${end.if.resultcomplex}

${if.description}
#### Details
${method.description}
${end.if.description}

#### Promise Resolution

| Type | Description |
|------|-------------|
| `bigint` | Listener ID to clear() the callback method and stop receiving the event, e.g. `${info.title}.clear(id)` |

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

<h6>Request</h6>

```json
${example.jsonrpc}
```

<h6>Response</h6>

```json
${example.response}
```

</details>

${end.example}

##### Listen to an event only once
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${info.title}.listen('${event.name}', (value) => {
  console.log(value)
}).then( (listenerId) => {
  ${info.title}.clear(listenerId)
})
```

Alternately, simply call `once()`:

```javascript
${info.title}.once('${event.name}', (value) => {
  console.log(value)
})
```
</details>

##### Clear all listeners for an event
<details>
  <summary><b>JavaScript</b></summary>

```javascript
${info.title}.clear('${event.name}')
```
</details>

---
