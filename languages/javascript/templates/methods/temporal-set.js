function ${method.name}(...args) {
    let add, remove, timeout
    if (typeof args[args.length-1] === 'function' && typeof args[args.length-2] === 'function') {
        remove = args.pop()
        add = args.pop()
    }
    else if (typeof args[args.length-1] === 'function') {
        add = args.pop()
    }
    else if (typeof args[args.length-1] === 'number') {
        timeout = args.pop()
    }

    const transforms = ${method.transforms}
    
    return TemporalSet.start('${info.title}', '${method.name}', '${method.temporalset.add}', '${method.temporalset.remove}', args, add, remove, timeout, transforms)
}