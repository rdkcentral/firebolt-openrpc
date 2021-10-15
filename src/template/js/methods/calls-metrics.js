
import { ${method.name} as log${method.Name} } from '../Metrics'

function ${method.name}(${method.params}) {
    const p = Transport.send('${info.title}', '${method.name}', { ${method.params} })
    
    p.then(_ => {
        setTimeout(_ => {
            log${method.Name}(${method.params})
        })    
    })

    return p
}