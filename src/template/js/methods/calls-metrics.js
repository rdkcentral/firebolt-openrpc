
import { ${method.name} as log${method.Name} } from '../Metrics/index.mjs'

function ${method.name}(${method.params}) {
    const transforms = ${method.transforms}

    const p = Transport.send('${info.title}', '${method.name}', { ${method.params} }, transforms)
    
    p.then(_ => {
        setTimeout(_ => {
            log${method.Name}(${method.params})
        })    
    }).catch(error => {
        const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
        console.error(`Metrics1 '${method.name}' callback failed: ${msg}`)
    })

    return p
}