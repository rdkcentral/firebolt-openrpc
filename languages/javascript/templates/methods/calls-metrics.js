
import { ${method.name} as log${method.Name} } from '../Metrics/index.mjs'

function ${method.name}(${method.params.list}) {
    const p = Gateway.request('${info.title}.${method.name}', { ${method.params.list} })${method.transform}
    
    p.then(_ => {
        setTimeout(_ => {
            log${method.Name}(${method.params.list})
        })    
    }).catch(error => {
        const msg = typeof error === 'string' ? error : error.message || 'Unknown Error'
        console.error(`Metrics '${method.name}' callback failed: ${msg}`)
    })

    return p
}