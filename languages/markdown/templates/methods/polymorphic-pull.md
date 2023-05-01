### ${method.name}
${method.description}

To allow the platform to pull data, use `${method.name}(callback: Function)`:

${method.puller}

To push data to the platform, e.g. during app launch, use `${method.name}(${method.params[1].name}: ${method.params[1].type})`:

```typescript
function ${method.name}(${method.params[1].name}: ${method.params[1].type}): Promise<${method.result.type}>
```

Parameters: 

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `${method.params[1].name}` | `${method.params[1].type}` | Yes | The `${method.params[1].type}` data to push to the platform |

```typescript
${method.pulls.result}
```

${method.seeAlso}

Promise resolution:

| Type | Summary |
| ---- | ------- |
| `boolean` | Whether or not the push was successful |

#### Examples

${method.examples}

---
