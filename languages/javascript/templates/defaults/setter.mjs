    ${method.name}: function (params) {
        const callbackOrValue = params.value
        delete params.value
        return MockProps.mock('${info.title}', '${method.setter.for}', params, callbackOrValue, ${method.context.count}, ${method.example.value})
    }