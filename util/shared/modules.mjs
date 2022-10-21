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
    and(
        compose(
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
            getPath(['tags']),        
        ),
        propSatisfies('name', (prop) => prop.startsWith('onRequest'))
    )
  )


const getUsedCapabilitiesFromMethod = (json) => {
    return (json && json.tags && json.tags.find(t => t.name === "capabilities") || {})['x-uses'] || []
}

const getManagedCapabilitiesFromMethod = (json) => {
    return (json && json.tags && json.tags.find(t => t.name === "capabilities") || {})['x-manages'] || []
}

const getProvidedCapabilitiesFromMethod = (json) => {
    return (json && json.tags && json.tags.find(t => t.name === "capabilities") || {})['x-provides'] || []
}

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

const isEventMethodWithContext = compose(
    and(
        compose(
            option(false),
            map(_ => true),
            chain(find(propEq('name', 'event'))),
            getPath(['tags'])
        ),
        compose(
            map(params => {
                return params.length > 1
            }),
            //propSatisfies('length', length => length > 1),
            getPath(['params'])
        )        
    )
  )
  

const isPolymorphicPullMethod = compose(
    option(false),
    map(_ => true),
    chain(find(hasProp('x-pulls-for'))),
    getPath(['tags'])
)

const isTemporalSetMethod = compose(
    option(false),
    map(_ => true),
    chain(find(propEq('name', 'temporal-set'))),
    getPath(['tags'])
)

const getMethodAttributes = compose(
    option(null),
    map(props => props.reduce( (val, item) => {
        val[item['__key']] = item;
        delete item['__key'];
        return val
    }, {})),
    map(filter(hasProp('x-method'))),
    map(props => props.map(([k, v]) => ({ "__key": k, ...v}))),
    map(Object.entries),
    map(schema => schema.items ? schema.items.properties || {} : schema.properties || {}),
    getPath(['result', 'schema'])
)

const hasMethodAttributes = compose(
    option(false),
    map(_ => true),
    chain(find(hasProp('x-method'))),
    map(Object.values),
    map(schema => schema.items ? schema.items.properties || {} : schema.properties || {}),
    getPath(['result', 'schema'])
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
    event.params = []
    event.name = 'onPull' + event.name.charAt(0).toUpperCase() + event.name.substr(1)
    const old_tags = pusher.tags.concat()

    event.tags[0]['x-pulls-for'] = pusher.name
    event.tags.push({
        name: 'rpc-only'
    })

    const requestType = (pusher.name.charAt(0).toUpperCase() + pusher.name.substr(1)) + "FederatedRequest"
    event.result.name = "request"
    event.result.summary = "A " + requestType + " object."

    event.result.schema = {
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

const createTemporalEventMethod = (method, json, name) => {
    const event = createEventFromMethod(method, json, name, 'x-temporal-for', ['temporal-set'])

    // copy the array items schema to the main result for individual events
    event.result.schema = method.result.schema.items

    event.tags = event.tags.filter(t => t.name !== 'temporal-set')
    event.tags.push({
        name: "rpc-only"
    })

    event.params.unshift({
        name: "correlationId",
        required: true,
        schema: {
            type: "string"
        }
    })

    event.examples && event.examples.forEach(example => {
        example.params.unshift({
            name: "correlationId",
            value: "xyz"
        })
        example.result.value = example.result.value[0]
    })

    return event
}

const createEventFromMethod = (method, json, name, correlationExtension, tagsToRemove = []) => {
    const event = eventDefaults(JSON.parse(JSON.stringify(method)))
    event.name = 'on' + name
    const old_tags = method.tags.concat()

    event.tags[0][correlationExtension] = method.name
    event.tags.push({
        name: 'rpc-only'
    })

    old_tags.forEach(t => {
        if (!tagsToRemove.find(t => tagsToRemove.includes(t.name)))
        {
            event.tags.push(t)
        }
    })

    return event
}

const createTemporalStopMethod = (method, jsoname) => {
    const stop = JSON.parse(JSON.stringify(method))

    stop.name = 'stop' + method.name.charAt(0).toUpperCase() + method.name.substr(1)

    stop.tags = stop.tags.filter(tag => tag.name !== 'temporal-set')
    stop.tags.push({
        name: "rpc-only"
    })

    // copy the array items schema to the main result for individual events
    stop.result.name = "result"
    stop.result.schema = {
        type: "null"
    }

    stop.params = [{
        name: "correlationId",
        required: true,
        schema: {
            type: "string"
        }
    }]

    stop.examples && stop.examples.forEach(example => {
        example.params = [{
            name: "correlationId",
            value: "xyz"
        }]

        example.result = {
            name: "result",
            value: null
        }
    })

    return stop
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

    const param = setter.result
    param.name = 'value'
    param.required = true
    setter.params.push(param)
    
    setter.result = {
        name: 'result',
        schema: {
            type: "null"
        }
    }

    setter.examples && setter.examples.forEach(example => {
        example.params.push({
            name: 'value',
            value: example.result.value
        })

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
        throw "Can only create a focus callback for methods that start with 'onRequest'."
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

// type = Response | Error
const createResponseFromProvider = (provider, type, json) => {

    if (!provider.name.startsWith('onRequest')) {
        throw "Can only create a response callback for methods that start with 'onRequest'."
    }

    const response = JSON.parse(JSON.stringify(provider))
    response.name = response.name.charAt(9).toLowerCase() + response.name.substr(10) + type
    response.summary = `Internal API for ${provider.name.substr(9)} Provider to send back ${type.toLowerCase()}.`
    const old_tags = response.tags
    response.tags = [
        {
            'name': 'rpc-only'
        }
    ]
    response.tags[`x-${type.toLowerCase()}-for`] = provider.name

    const paramExamples = []

    if (provider.tags.find(t => t[`x-${type.toLowerCase()}`])) {
        response.params = [
            {
                name: type.toLowerCase(),
                required: true,
                schema: {
                    allOf: [
                        {
                            "$ref": "https://meta.comcast.com/firebolt/types#/definitions/ProviderResponse" // use this schema for both Errors and Results
                        },
                        {
                            "type": "object",
                            "properties": {
                                "result": provider.tags.find(t => t[`x-${type.toLowerCase()}`])[`x-${type.toLowerCase()}`]
                            }
                        }
                    ]
                }
            }
        ]

        if (!provider.tags.find(t => t['x-error'])) {
            provider.tags.find(t => t.name === 'event')['x-error'] = {
                //"$ref": "https://meta.open-rpc.org/#definitions/errorObject"
                // TODO: replace this with ref above (requires merge of `fix/rpc.discover`)
                "type": "object",
                "additionalProperties": false,
                "required": [
                  "code",
                  "message"
                ],
                "properties": {
                  "code": {
                    "title": "errorObjectCode",
                    "description": "A Number that indicates the error type that occurred. This MUST be an integer. The error codes from and including -32768 to -32000 are reserved for pre-defined errors. These pre-defined errors SHOULD be assumed to be returned from any JSON-RPC api.",
                    "type": "integer"
                  },
                  "message": {
                    "title": "errorObjectMessage",
                    "description": "A String providing a short description of the error. The message SHOULD be limited to a concise single sentence.",
                    "type": "string"
                  },
                  "data": {
                    "title": "errorObjectData",
                    "description": "A Primitive or Structured value that contains additional information about the error. This may be omitted. The value of this member is defined by the Server (e.g. detailed error information, nested errors etc.)."
                  }
                }
            }
        }

        const schema = localizeDependencies(provider.tags.find(t => t[`x-${type.toLowerCase()}`])[`x-${type.toLowerCase()}`], json)

        let n = 1
        if (schema.examples && schema.examples.length) {
            paramExamples.push(... (schema.examples.map( param => ({
                name: schema.examples.length === 1 ? "Example" : `Example #${n++}`,
                params: [
                    {
                        name: `${type.toLowerCase()}`,
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
                        name: `${type.toLowerCase()}`,
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
    
    if (paramExamples.length === 0) {
        const value = type === 'Error' ? { code: 1, message: 'Error' } : {}
        paramExamples.push(
            {
                name: 'Example 1',
                params: [
                    {
                        name: `${type.toLowerCase()}`,
                        value: {
                            correlationId: "123",
                            result: value
                        }                        
                    }
                ],
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

const generateHttpExtensions = json => {
    const https = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'http')) || []
    https.forEach(method => {
        Object.keys(json.info).forEach(key => {
            if (key.startsWith('x-http')) {
                method.tags.find(t => t.name === 'http')[key] = method[key] || json.info[key]
            }
        })
    })

    return json
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

const generateTemporalSetMethods = json => {
    const temporals = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'temporal-set')) || []

    temporals.forEach(temporal => json.methods.push(createTemporalEventMethod(temporal, json, (temporal.result.schema.items.title || 'Item') + 'Available')))
    temporals.forEach(temporal => json.methods.push(createTemporalEventMethod(temporal, json, (temporal.result.schema.items.title || 'Item') + 'Unavailable')))
    temporals.forEach(temporal => json.methods.push(createTemporalStopMethod(temporal, json)))

    return json
}


const generateProviderMethods = json => {
    const providers = json.methods.filter(isProviderMethod) || []// m => m.tags && m.tags.find( t => t.name == 'capabilities' && t['x-provides'])) || []

    providers.forEach(provider => {
        if (! isRPCOnlyMethod(provider)) {
            provider.tags.push({
                "name": "rpc-only"
            })
        }
        // only create the ready method for providers that require a handshake
        if (provider.tags.find(t => t['x-allow-focus'])) {
            json.methods.push(createFocusFromProvider(provider, json))
        }
    })

    providers.forEach(provider => {
        if (provider.name.startsWith("onRequest")) {
            json.methods.push(createResponseFromProvider(provider, 'Response', json))
            json.methods.push(createResponseFromProvider(provider, 'Error', json))
        }
    })

    return json
}

const generateEventListenerParameters = json => {
    const events = json.methods.filter( m => m.tags && m.tags.find(t => t.name == 'event')) || []

    events.forEach(event => {
        event.params = event.params || []
        event.params.push({
            "name": "listen",
            "required": true,
            "schema": {
                "type": "boolean"
            }
        })

        event.examples = event.examples || []

        event.examples.forEach(example => {
            example.params = example.params || []
            example.params.push({
                "name": "listen",
                "value": true
            })
        })
    })

    return json
}

const generateEventListenResponse = json => {
    const events = json.methods.filter( m => m.tags && m.tags.find(t => t.name == 'event')) || []

    events.forEach(event => {
        // only want or and xor here (might even remove xor)
        const anyOf = event.result.schema.oneOf || event.result.schema.anyOf
        const ref = {
            "$ref": "https://meta.comcast.com/firebolt/types#/definitions/ListenResponse"
        }

        if (anyOf) {
            anyOf.splice(0, 0, ref)
        }
        else {
            event.result.schema = {
                anyOf: [
                    ref,
                    event.result.schema
                ]
            }
        }
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

const fireboltize = (json) => {
    json = generatePropertyEvents(json)
    json = generatePropertySetters(json)
    json = generatePolymorphicPullEvents(json)
    json = generateProviderMethods(json)
    json = generateTemporalSetMethods(json)
    json = generateEventListenerParameters(json)
    json = generateEventListenResponse(json)
    json = generateHttpExtensions(json)
    
    return json
}

export {
    isEnum,
    isEventMethod,
    isEventMethodWithContext,
    isPublicEventMethod,
    isPolymorphicReducer,
    isPolymorphicPullMethod,
    isTemporalSetMethod,
    isExcludedMethod,
    isRPCOnlyMethod,
    isProviderMethod,
    hasExamples,
    hasTitle,
    hasMethodAttributes,
    getMethodAttributes,
    getMethods,
    getMethodsThatProvide,
    getProvidedCapabilities,
    getEnums,
    getTypes,
    getEvents,
    getPublicEvents,
    getSchemas,
    getParamsFromMethod,
    getUsedCapabilitiesFromMethod,
    getManagedCapabilitiesFromMethod,
    getProvidedCapabilitiesFromMethod,
    getPayloadFromEvent,
    providerHasNoParameters,
    fireboltize
}