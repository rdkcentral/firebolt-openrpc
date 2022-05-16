/*
 * Copyright 2021 Comcast Cable Communications Management, LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import helpers from 'crocks/helpers/index.js'
const { compose, getPathOr } = helpers
import safe from 'crocks/Maybe/safe.js'
import find from 'crocks/Maybe/find.js'
import getPath from 'crocks/Maybe/getPath.js'
import pointfree from 'crocks/pointfree/index.js'
const { chain, filter, option, map } = pointfree
import logic from 'crocks/logic/index.js'
import isEmpty from 'crocks/core/isEmpty.js'
const { and, not } = logic
import isString from 'crocks/core/isString.js'
import predicates from 'crocks/predicates/index.js'
import { getSchema, isNull, localizeDependencies } from './json-schema.mjs'
const { isObject, isArray, propEq, pathSatisfies, hasProp, propSatisfies } = predicates

// util for visually debugging crocks ADTs
const inspector = obj => {
    if (obj.inspect) {
        console.log(obj.inspect())
    } else {
        console.log(obj)
    }
}

const isEnum = compose(
    filter(x => x.type === 'string' && Array.isArray(x.enum) && x.title),
    map(([_, val]) => val),
    filter(([_key, val]) => isObject(val))
)  

// Maybe methods array of objects
const getMethods = compose(
    option([]),
    map(filter(isObject)),
    chain(safe(isArray)),
    getPath(['methods'])
)

const isProviderMethod = compose(
    option(false),
    map(_ => true),
    chain(
      find(
        and(
          propEq('name', 'capabilities'),
          propSatisfies('x-provides', not(isEmpty))
        )
      )
    ),
    getPath(['tags'])
  )

const getProvidedCapabilities = (json) => {
    return Array.from(new Set([...getMethods(json).filter(isProviderMethod).map(method => method.tags.find(tag => tag['x-provides'])['x-provides'])]))
}

const getMethodsThatProvide = (capability, json) => {
    return getMethods(json).filter(method => method.tags && method.tags.find(tag => tag['x-provides'] === capability))
}
  

const addMissingTitles = ([k, v]) => {
    if (v && !v.hasOwnProperty('title')) {
        v.title = k
    }
    return v
}

// Maybe an array of <key, value> from the schema
const getSchemas = compose(
    option([]),
    chain(safe(isArray)),
    map(Object.entries), // Maybe Array<Array<key, value>>
    chain(safe(isObject)), // Maybe Object
    getPath(['components', 'schemas']) // Maybe any
)

const getEnums = compose(
    filter(x => x[1].enum),
    getSchemas
)

const getTypes = compose(
//    filter(x => !x.enum),
    getSchemas
 )

const isEventMethod = compose(
    option(false),
    map(_ => true),
    chain(find(propEq('name', 'event'))),
    getPath(['tags'])
)

const isPolymorphicPullMethod = compose(
    option(false),
    map(_ => true),
    chain(find(hasProp('x-pulls-for'))),
    getPath(['tags'])
)

const isPublicEventMethod = and(
    compose(
        option(true),
        map(_ => false),
        chain(find(propEq('name', 'rpc-only'))),
        getPath(['tags'])
    ),
    compose(
        option(false),
        map(_ => true),
        chain(find(propEq('name', 'event'))),
        getPath(['tags'])
    )
)

const isExcludedMethod = compose(
    option(false),
    map(_ => true),
    chain(find(propEq('name', 'exclude-from-sdk'))),
    getPath(['tags'])
)

const isRPCOnlyMethod = compose(
    option(false),
    map(_ => true),
    chain(find(propEq('name', 'rpc-only'))),
    getPath(['tags'])
)


const isPolymorphicReducer = compose(
    option(false),
    map(_ => true),
    chain(find(propEq('name', 'polymorphic-reducer'))),
    getPath(['tags'])
)

const hasTitle = compose(
    option(false),
    map(isString),
    getPath(['info', 'title'])
)

const hasExamples = compose(
    option(false),
    map(isObject),
    getPath(['examples', 0])
)

const getParamsFromMethod = compose(
    option([]),
    getPath(['params'])
)

const getPayloadFromEvent = (event, json, schemas = {}) => {
    const choices = (event.result.schema.oneOf || event.result.schema.anyOf)
    const choice = choices.find(schema => schema.title !== 'ListenResponse' && !(schema['$ref'] || '').endsWith('/ListenResponse'))
    return localizeDependencies(choice, json, schemas)
}

const providerHasNoParameters = (schema) => {
    if (schema.allOf || schema.oneOf) {
        return !!(schema.allOf || schema.oneOf).find(schema => providerHasNoParameters(schema))
    }
    else if (schema.properties && schema.properties.parameters) {
        return isNull(schema.properties.parameters)
    }
    else {
        console.dir(schema, {depth: 10})
        throw "Invalid ProviderRequest"
    }
}

const validEvent = and(
    pathSatisfies(['name'], isString),
    pathSatisfies(['name'], x => x.match(/on[A-Z]/))
)

// Pick events out of the methods array
const getEvents = compose(
    option([]),
    map(filter(validEvent)),
    // Maintain the side effect of process.exit here if someone is violating the rules
    map(map(e => {
        if (!e.name.match(/on[A-Z]/)) {
            console.error(`ERROR: ${e.name} method is tagged as an event, but does not match the pattern "on[A-Z]"`)
            process.exit(1) // Non-zero exit since we don't want to continue. Useful for CI/CD pipelines.
        }
        return e
    })),
    inspector,
    map(filter(isEventMethod)),
    getMethods
)

const getPublicEvents = compose(
    map(filter(isPublicEventMethod)),
    getEvents
)

const eventDefaults = event => {

    event.tags = [
        {
            'name': 'event'
        }
    ]    

    event.params = [
        {
            name: 'listen',
            required: true,
            schema: {
                type: 'boolean'
            }
        }
    ]

    event.result.schema = {
        "oneOf": [
            {
                "$ref": "https://meta.comcast.com/firebolt/types#/definitions/ListenResponse"
            },
            event.result.schema
        ]
    }

    event.examples && event.examples.forEach(example => {
        example.params = [
            {
                name: 'listen',
                value: true
            }
        ]
    })

    return event
}

const createEventFromProperty = property => {
    const event = eventDefaults(JSON.parse(JSON.stringify(property)))
    event.name = 'on' + event.name.charAt(0).toUpperCase() + event.name.substr(1) + 'Changed'
    const old_tags = property.tags.concat()

    event.tags[0]['x-alternative'] = property.name

    old_tags.forEach(t => {
        if (t.name !== 'property' && !t.name.startsWith('property:'))
        {
            event.tags.push(t)
        }
    })

    return event
}

const createPullEventFromPush = (pusher, json) => {
    const event = eventDefaults(JSON.parse(JSON.stringify(pusher)))
    event.name = 'onPull' + event.name.charAt(0).toUpperCase() + event.name.substr(1)
    const old_tags = pusher.tags.concat()

    event.tags[0]['x-pulls-for'] = pusher.name
    event.tags.push({
        name: 'rpc-only'
    })

    const requestType = (pusher.name.charAt(0).toUpperCase() + pusher.name.substr(1)) + "FederatedRequest"
    event.result.name = "request"
    event.result.summary = "A " + requestType + " object."
    event.result.schema.oneOf[1] = {
        "$ref": "#/components/schemas/" + requestType
    }

    const exampleResult = {
        name: "result",
        value: JSON.parse(JSON.stringify(getPathOr(null, ['components', 'schemas', requestType, 'examples', 0], json)))
    }

    event.examples && event.examples.forEach(example => {
        example.result = exampleResult
    })

    old_tags.forEach(t => {
        if (t.name !== 'polymorphic-pull')
        {
            event.tags.push(t)
        }
    })

    return event
}

const createSetterFromProperty = property => {
    const setter = JSON.parse(JSON.stringify(property))
    setter.name = 'set' + setter.name.charAt(0).toUpperCase() + setter.name.substr(1)
    const old_tags = setter.tags
    setter.tags = [
        {
            'name': 'rpc-only',
            'x-setter-for': property.name
        }
    ]

    setter.params.push(setter.result)
    setter.result = {
        name: 'result',
        schema: {
            type: "null"
        }
    }

    setter.examples && setter.examples.forEach(example => {
        example.params[0] = {
            name: 'value',
            value: example.result.value
        }

        example.result.value = null
    })

    old_tags.forEach(t => {
        if (t.name !== 'property' && !t.name.startsWith('property:'))
        {
            setter.tags.push(t)
        }
    })

    return setter
}

const createFocusFromProvider = provider => {

    if (!provider.name.startsWith('onRequest')) {
        throw "Methods with the `x-provider` tag extension MUST start with 'onRequest'."
    }
    
    const ready = JSON.parse(JSON.stringify(provider))
    ready.name = ready.name.charAt(9).toLowerCase() + ready.name.substr(10) + 'Focus'
    ready.summary = `Internal API for ${provider.name.substr(9)} Provider to request focus for UX purposes.`
    const old_tags = ready.tags
    ready.tags = [
        {
            'name': 'rpc-only',
            'x-allow-focus-for': provider.name
        }
    ]

    ready.params = []
    ready.result = {
        name: 'result',
        schema: {
            type: "null"
        }
    }

    ready.examples = [
        {
            name: "Example",
            params: [],
            result: {
                name: "result",
                value: null
            }
        }
    ]

    return ready
}

const createResponseFromProvider = (provider, json) => {

    if (!provider.name.startsWith('onRequest')) {
        throw "Methods with the `x-provider` tag extension MUST start with 'onRequest'."
    }

    const response = JSON.parse(JSON.stringify(provider))
    response.name = response.name.charAt(9).toLowerCase() + response.name.substr(10) + 'Response'
    response.summary = `Internal API for ${provider.name.substr(9)} Provider to send back a response.`
    const old_tags = response.tags
    response.tags = [
        {
            'name': 'rpc-only',
            'x-response-for': provider.name
        }
    ]

    const paramExamples = []

    if (provider.tags.find(t => t['x-response'])) {
        response.params = [
            {
                name: 'response',
                required: true,
                schema: {
                    allOf: [
                        {
                            "$ref": "https://meta.comcast.com/firebolt/types#/definitions/ProviderResponse"
                        },
                        {
                            "type": "object",
                            "properties": {
                                "result": provider.tags.find(t => t['x-response'])['x-response']
                            }
                        }
                    ]
                }
            }
        ]

        const schema = localizeDependencies(provider.tags.find(t => t['x-response'])['x-response'], json)

        let n = 1
        if (schema.examples && schema.examples.length) {
            paramExamples.push(... (schema.examples.map( param => ({
                name: schema.examples.length === 1 ? "Example" : `Example #${n++}`,
                params: [
                    {
                        name: 'response',
                        value: {
                            correlationId: "123",
                            result: param
                        }
                    }
                ],
                result: {
                    name: 'result',
                    value: null
                }
            }))  || []))
            delete schema.examples    
        }
        else if (schema['$ref']) {
            paramExamples.push({
                name: 'Generated Example',
                params: [
                    {
                        name: 'response',
                        value: {
                            correlationId: "123",
                            result: {
                                '$ref': schema['$ref'] + '/examples/0'
                            }
                        }
                    }
                ],
                result: {
                    name: 'result',
                    value: null
                }
            })
        }
    }
    else {
        response.params = []
        paramExamples.push(
            {
                name: 'Example 1',
                params: [],
                result: {
                    name: 'result',
                    value: null
                }
            })
    }

    response.result = {
        name: 'result',
        schema: {
            type: 'null'
        }
    }

    response.examples = paramExamples

    return response
}

const generatePropertyEvents = json => {
    const properties = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property')) || []
    const readonlies = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property:readonly')) || []

    properties.forEach(property => json.methods.push(createEventFromProperty(property)))
    readonlies.forEach(property => json.methods.push(createEventFromProperty(property)))

    return json
}

const generatePropertySetters = json => {
    const properties = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property')) || []

    properties.forEach(property => json.methods.push(createSetterFromProperty(property)))

    return json
}

const generatePolymorphicPullEvents = json => {
    const pushers = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'polymorphic-pull')) || []

    pushers.forEach(pusher => json.methods.push(createPullEventFromPush(pusher, json)))

    return json
}

const generateProviderMethods = json => {
    const providers = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'capabilities' && t['x-provides'])) || []

    providers.forEach(provider => {
        // only create the ready method for providers that require a handshake
        if (provider.tags.find(t => t['x-allow-focus'])) {
            json.methods.push(createFocusFromProvider(provider, json))
        }
    })

    providers.forEach(provider => {
        json.methods.push(createResponseFromProvider(provider, json))
    })

    return json
}

const getPathFromModule = (module, path) => {
    console.error("DEPRECATED: getPathFromModule")
    
    if (!path) return null

    let item = module

    try {
      path = path.split('#').pop().split('/')
      path.shift()
      path.forEach(node => { item = item[node] })  
    }
    catch (err) {
      return null
    }
  
    return item    
}

export {
    isEnum,
    isEventMethod,
    isPublicEventMethod,
    isPolymorphicReducer,
    isPolymorphicPullMethod,
    isExcludedMethod,
    isRPCOnlyMethod,
    isProviderMethod,
    hasExamples,
    hasTitle,
    getMethods,
    getMethodsThatProvide,
    getProvidedCapabilities,
    getEnums,
    getTypes,
    getEvents,
    getPublicEvents,
    getSchemas,
    getParamsFromMethod,
    getPayloadFromEvent,
    getPathFromModule,
    generatePolymorphicPullEvents,
    generatePropertyEvents,
    generatePropertySetters,
    generateProviderMethods,
    providerHasNoParameters
}