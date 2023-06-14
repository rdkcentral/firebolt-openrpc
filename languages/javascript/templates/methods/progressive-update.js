function ${method.name}(...args) {
    const transforms = ${method.transforms}
    
    return ProgressiveUpdate.start('${info.title}', '${method.name}', args, 'on${method.Name}Progress', 'on${method.Name}Complete', transforms)
}