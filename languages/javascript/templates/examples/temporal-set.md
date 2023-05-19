import { ${module} } from '${package.name}'

const process = ${module}.${method.name}(${example.params}${if.params},${end.if.params}
    ${method.item} => {
        console.log('Added to temporal set:')
        console.dir(${method.item})
    },
    ${method.item} => {
        console.log('Removed from temporal set:')
        console.dir(${method.item})
    })

setTimeout( () => process.stop(), 10000)
```

Request only the first match:

```javascript
import { ${module} } from '${package.name}'

const ${method.item} = await ${module}.${method.name}(${example.params}${if.params}, ${end.if.params}1000)