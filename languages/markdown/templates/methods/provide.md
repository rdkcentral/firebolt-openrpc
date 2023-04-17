### provide

To provide a specific capability to the platform. See [Provider Interfaces](#provider-interfaces) for a list of interfaces available to provide in this module.

```typescript
provide(capability: string, provider: any): void
```

Parameters:

| Param                  | Type                 | Required                 | Summary                 |
| ---------------------- | -------------------- | ------------------------ | ----------------------- |
| `capability` | `string` | Yes | The capability that is being provided. |
| `provider` | `any` | Yes | An implementation of the required interface. |

See [Provider Interfaces](#provider-interfaces) for each capabilities interface definition.
