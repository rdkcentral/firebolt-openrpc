### ${method.name}
${method.description}

To listen to a specific event pass the event name as the first parameter:

${if.javascript}

```typescript
${info.title}.${method.name}(event: string, (data: any) => void): Promise<bigint>
```

${end.if.javascript}

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `event` | `string` | Yes | The event to listen for, see [Events](#events). |
| *callback* | `function` | Yes | A function that will be invoked when the event occurs. |

#### Promise Resolution

| Type | Description |
|------|-------------|
| `bigint` | Listener ID to clear the callback method and stop receiving the event, e.g. `${info.title}.clear(id)` |

#### Callback Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `data` | `any` | Yes | The event data, which depends on which event is firing, see [Events](#events). |

To listen to all events from this module  pass only a callback, without specifying an event name:

${if.javascript}

```typescript
${info.title}.${method.name}((event: string, data: any) => void): Promise<bigint>
```

${end.if.javascript}

#### Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| *callback* | `function` | Yes | A function that will be invoked when the event occurs. The event data depends on which event is firing, see [Events](#events). |


#### Callback Parameters

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `event` | `string` | Yes | The event that has occured listen for, see [Events](#events). |
| `data` | `any` | Yes | The event data, which depends on which event is firing, see [Events](#events). |


#### Promise Resolution

| Type | Description |
|------|-------------|
| `bigint` | Listener ID to clear the callback method and stop receiving the event, e.g. `${info.title}.clear(id)` |
---

#### Examples
See [Listener for events](../../docs/listening-for-events/) for examples.

---
${end.method}
