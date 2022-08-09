function ${method.name}(${method.params}) {

    const headers = ${http.headers}
    const params = { ${method.params} }
    const method = '${http.method}'
    let query = '${http.query}'

    let path = '${http.path}' || '/${info.title}/${method.name}'
    
    Object.entries(params).forEach(([name, value]) => {
        const find = '${param.' + name + '}'
        path = path.replace(find, value)
        query = query.replace(find, value)
        Object.keys(headers).forEach(header => {
            headers[header] = headers[header].replace(find, value)
        })
    })

    const httpQueryParams = query && query.split("&").reduce((obj, param) => { obj[param.split('=').shift()] = param.split("=").pop(); return obj }, {})

    if (method === 'POST') {
        return Http.send(path, 'POST', headers, JSON.stringify(params), httpQueryParams)
    }
    else {
        return Http.send(path, method, headers, httpQueryParams)
    }
}