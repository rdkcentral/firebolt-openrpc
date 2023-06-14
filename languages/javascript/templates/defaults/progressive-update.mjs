${method.name}:  () => {
    const progress = {
        percent: .25,
        data: ${method.example.value}
    }
    const complete = ${method.example.value}

    setTimeout(_ => {
        // Mock an error for testing
        MockTransport.event('${info.title}', '${method.name}Error', { code: 1000, message: "Mock Error for testing"})

        MockTransport.event('${info.title}', '${method.name}Progress', progress)
        progress.percent = .5
        MockTransport.event('${info.title}', '${method.name}Progress', progress)
    
        progress.percent = .75
        MockTransport.event('${info.title}', '${method.name}Progress', progress)
    
        progress.percent = 1
        MockTransport.event('${info.title}', '${method.name}Progress', progress)
    
        MockTransport.event('${info.title}', '${method.name}Complete', complete)    
    }, 500)

    return ${method.example.value}
}