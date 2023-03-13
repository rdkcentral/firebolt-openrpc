import { ${module} } from '${pkg.name}'

const process = ${module}.${method.name}(function(${example.params}${if.params},${end.if.params}
    ${method.item} => {
        console.log('Added to temporal set:')
        console.dir(${method.item})
    },
    ${method.item} => {
        console.log('Removed from temporal set:')
        console.dir(${method.item})
    })

setTimeout( () => process.stop(), 10000)