import fs from 'fs'

const run = ({
    base: base,
    sdk: sdk,
    output: output
  }) => {
  
    console.log(base)
    console.log(sdk)
    console.log(output)

//    const base = base //JSON.parse(fs.readFileSync('src/json/firebolt-specification-base.json'))

    const sdk_names = {
        'core': 'node_modules/@firebolt-js/sdk/dist/firebolt-open-rpc.json',
        'manage': 'node_modules/@firebolt-js/manage/dist/firebolt-open-rpc.json',
        'discovery': 'node_modules/@firebolt-js/discovery/dist/firebolt-open-rpc.json'
    }

    const sdks = {
        methods: []
    }

    Object.keys(sdk_names).map(name => {
        const sdk = JSON.parse(fs.readFileSync(sdk_names[name]))

        // make sure there are no duplicate methods across SDKs
        sdk.methods.forEach(item => {
            if (!item.name.startsWith('rpc.')) {
                if (sdks.methods.find(existingItem => existingItem.name === item.name)) {
                    throw new Error(`Error: '${name}' SDK has a duplicate method '${item.name}.`)
                }
            }
        })

        sdks.methods.push(...sdk.methods.filter(m => !m.name.startsWith('rpc.')))
    })

    base = JSON.parse(fs.readFileSync(base))

    const getTag = (method, tag) => method.tags ? method.tags.find(t => t.name == tag) || {} : {}
    const getCapabilities = (method, role) => getTag(method, 'capabilities') ? getTag(method, 'capabilities')['x-' + role] || [] : []
    const hasAnyCapabilities = method => hasCapabilities(method, 'uses') || hasCapabilities(method, 'provides') || hasCapabilities(method, 'manages')
    const hasCapabilities = (method, role) => getCapabilities(method, role).length > 0
    const hasNoCapabilities = method => !hasAnyCapabilities(method)
    const isValidCapability = capability => base.capabilities.find(c => c.id === capability)
    const getInvalidCapabilities = method => getCapabilities(method, 'uses').filter(c => !isValidCapability(c)).concat(getCapabilities(method, 'provides').filter(c => !isValidCapability(c))).concat(getCapabilities(method, 'manages').filter(c => !isValidCapability(c)))
    const hasInvalidCapabilities = method => (getInvalidCapabilities(method).length > 0)
    const isPrivateCapability = (capability, role) => !(base.capabilities.find(c => c.id === capability) || {use: { public: true}, manage: { public: true }, provide: { public: true }})[role].public
    const getPrivateCapabilities = (method) => getCapabilities(method, 'uses').filter(c => isPrivateCapability(c, 'use')).concat(getCapabilities(method, 'provides').filter(c => isPrivateCapability(c, 'provide'))).concat(getCapabilities(method, 'manages').filter(c => isPrivateCapability(c, 'manage')))
    const hasPrivateCapabilities = (method) => (getPrivateCapabilities(method).length > 0)

    let problems
    let errorCount = 0
    let warningCount = 0

    problems = sdks.methods.filter(hasNoCapabilities)
    warningCount += problems.length
    if (problems.length)
    console.warn('\nThe following methods have no capabilities tag: \n\t- ' + problems.map(m => m.name).join('\n\t- '))

    problems = sdks.methods.filter(hasInvalidCapabilities)
    errorCount += problems.length
    if (problems.length)
    console.error('\nThe following methods have invalid capabilities: \n\t- ' + problems.map(m => m.name + `: ${getInvalidCapabilities(m).join(', ')}`).join('\n\t- '))

    problems = sdks.methods.filter(hasPrivateCapabilities)
    errorCount += problems.length
    if (problems.length)
    console.error('\nThe following methods have private capabilities: \n\t- ' + problems.map(m => m.name + `: ${getPrivateCapabilities(m).join(', ')}`).join('\n\t- '))

    if (errorCount > 0) {
        console.warn(`\nFound ${errorCount} problems`)
    }
    else {
        const specification = JSON.parse(JSON.stringify(base))
        specification.apis = specification.apis || []
        specification.apis.push(...sdks.methods.filter(hasAnyCapabilities).map( method => {
            const methodInfo = {
            "method": method.name,
            "type": "firebolt"
            }

            if (hasCapabilities(method, 'uses')) {
            methodInfo.uses = getCapabilities(method, 'uses')
            }

            if (hasCapabilities(method, 'provides')) {
            methodInfo.provides = getCapabilities(method, 'provides')
            }

            if (hasCapabilities(method, 'manages')) {
            methodInfo.manages = getCapabilities(method, 'manages')
            }

            return methodInfo
        }))

        const orderedCompare = (a, b, order) => order.indexOf(a) - order.indexOf(b)
        const typeCompare = (a ,b) => {
            if (a.isExtension && b.isExtension)
                return 0
            else if (a.isExtension)
                return 1
            else if (b.isExtension)
                return -1
            else
                return 0
        }
        
        const levelCompare = (a ,b) => {
            const result = orderedCompare(a.level, b.level, ['must', 'should', 'could'])
            if (result === 0) {
                return a.id.localeCompare(b.id)
            }
            else {
                return result
            }
        }
        const capabilityCompare = (a, b) => {
            const result = typeCompare(a, b)
            
            if (result === 0) {
                return levelCompare(a, b)
            }
            else {
                return result
            }
        }

        const methodCompare = (a, b) => {
            const result = orderedCompare(a.type, b.type, ['firebolt', 'w3c', 'extension'])

            if (result === 0)
                return a.method.localeCompare(b.method)
            else
                return result
        }

        specification.capabilities.sort( capabilityCompare )
        specification.apis.sort( methodCompare )

        fs.writeFileSync(output, JSON.stringify(specification, null, '\t'))
        console.log('\nWrote Firebolt Specification:\n' + output)
    }

    console.log('\n')

    return {
        done: callback => callback()
    }
}

export default run