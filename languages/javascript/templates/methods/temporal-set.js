function ${method.name}(...args) {
    let add, remove
    if (typeof args[args.length-1] === 'function' && typeof args[args.length-2] === 'function') {
        remove = args.pop()
        add = args.pop()
    }
    else if (typeof args[args.length-1] === 'function') {
        add = args.pop()
    }

    const transforms = ${method.transforms}
    
    return TemporalSet.start('${info.title}', '${method.name}', '${method.temporalset.add}', '${method.temporalset.remove}', arguments, add, remove, transforms)
}