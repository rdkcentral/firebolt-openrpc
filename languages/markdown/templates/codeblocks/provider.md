### ${provider}
The provider interface for the `${capability}` capability.

```typescript
${interface}
```

Usage:

```typescript
${info.title}.provide('${capability}', provider: ${provider} | object)
```

${provider.methods}

#### Examples

**Register your app to provide the `${capability}` capability.**

```javascript
import { ${info.title} } from '${package.name}'

class My${provider} {
${provider.interface.start}
    async ${provider.interface.name}(parameters, session) {
        ${if.provider.interface.example.result}return ${provider.interface.example.result}${end.if.provider.interface.example.result}
    }
${provider.interface.end}
}

${info.title}.provide('${capability}', new My${provider}())
```

<details>
    <summary>JSON-RPC</summary>

**Register to recieve each provider API**

Request:

```json
${provider.interface.start}
{
    "id": ${provider.interface.i},
    "method": "${info.title}.onRequest${provider.interface.Name}",
    "params": {
        "listen": true
    }
}
${provider.interface.end}
```

Response:

```json
${provider.interface.start}
{
    "id": ${provider.interface.i},
    "result": {
        "listening": true,
        "event": "${info.title}.onRequest${provider.interface.Name}"
    }            
 
}
${provider.interface.end}
```

${provider.interface.start}

**Asynchronous event to initiate ${provider.interface.name}()**

Event Response:

```json
{
    "id": ${provider.interface.i},
    "result": {
        "correlationId": ${provider.interface.example.correlationId},
        "parameters": ${provider.interface.example.parameters}
    }
}
```

**App initiated response to event**

Request:

```json
{
    "id": ${provider.interface.j},
    "method": "${info.title}.${provider.interface.name}Response",
    "params": {
        "correlationId": ${provider.interface.example.correlationId},
        "result": ${provider.interface.example.result}
    }
}
```

Response:

```json
{
    "id": ${provider.interface.j},
    "result": true
}
```

${provider.interface.end}


</details>

