${method.name}:  () => {
    const status = {
        progress: .25,
        data: ${method.example.value}
    }
    const result = ${method.example.value}

    setTimeout(_ => {
        // Mock an error for testing
        MockTransport.event('${info.title}', '${method.name}Error', { code: 1000, message: "Mock Error for testing"})

        MockTransport.event('${info.title}', '${method.name}Progress', status)
        status.progress = .5
        MockTransport.event('${info.title}', '${method.name}Progress', status)
    
        status.progress = .75
        MockTransport.event('${info.title}', '${method.name}Progress', status)
    
        status.progress = 1
        MockTransport.event('${info.title}', '${method.name}Progress', status)
    
        MockTransport.event('${info.title}', '${method.name}Complete', result)    
    }, 500)

    return ${method.example.value}
}