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
const { compose, getPathOr, setPath } = helpers
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
import { getExternalSchemaPaths, isDefinitionReferencedBySchema, isNull, localizeDependencies, isSchema, getLocalSchemaPaths, replaceRef, getPropertySchema, getLinkedSchemaUris, getAllValuesForName, replaceUri } from './json-schema.mjs'
import { getReferencedSchema } from './json-schema.mjs'
const { isObject, isArray, propEq, pathSatisfies, hasProp, propSatisfies } = predicates
import { extension, getNotifier, isEvent, isNotifier, isPusher, isRegistration, name as methodName, rename as methodRename, provides } from './methods.mjs'

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

const isProviderInterfaceMethod = method => {
    let tag = method.tags.find(t => t.name === 'capabilities')
    const isProvider = tag['x-provides'] && !tag['x-allow-focus-for'] && !tag['x-response-for'] && !tag['x-error-for'] && !tag['x-push'] && !method.tags.find(t => t.name === 'registration')

    tag = method.tags.find(t => t.name.startsWith('polymorphic-pull'))
    const isPuller = !!tag
    return isProvider && !isPuller //(!method.tags.find(t => t.name.startsWith('polymorphic-pull')))
}

// const isProviderInterfaceMethod = compose(
//         compose(
//             option(false),
//             map(_ => true),
//             chain(
//               find(
//                 and(
//                   propEq('name', 'capabilities'),
//                   and(
//                     propSatisfies('x-provides', not(isEmpty)),
//                     and(
//                         propSatisfies('x-allow-focus-for', isEmpty),
//                         and(
//                             propSatisfies('x-response-for', isEmpty),
//                             propSatisfies('x-error-for', isEmpty)
//                         )
//                     )
//                   )
//                 )
//               )
//             ),
//             getPath(['tags'])        
//         )
//   )

const getProvidedCapabilities = (json) => {
    return Array.from(new Set([...getMethods(json).filter(isProviderInterfaceMethod).map(method => method.tags.find(tag => tag['x-provides'])['x-provides'])]))
}
const getProvidedInterfaces = (json) => {
//    return json.methods?.filter(m => extension(m, 'x-interface')).map(m => extension(m, 'x-interface')) || []
    return getInterfaces(json)

    const list = Array.from(new Set((json.methods || []).filter(m => m.tags.find(t => t['x-provides']))
    .filter(m => !extension(m, 'x-push'))
    .filter(m => !m.tags.find(t => t.name.startsWith('polymorphic-pull')))
    .map(m => m.name.split('.')[0])))

    return list
}

const getInterfaces = (json) => {
    const list = Array.from(new Set((json.methods || []).filter(m => m.tags.find(t => t['x-provides']))
    .filter(m => !m.tags.find(t => t.name.startsWith('registration')))
    .filter(m => !m.tags.find(t => t.name.startsWith('polymorphic-pull')))
    .filter(m => !extension(m, 'x-push'))
    .map(m => m.name.split('.')[0])))

    return list    
}

// TODO: this code is all based on capability, but we now support two interfaces in the same capability. need to refactor

const getProviderInterfaceMethods = (_interface, json, prefix) => {
    return json.methods.filter(method => method.name.split('.')[0] === _interface).filter(isProviderInterfaceMethod)
    //return getMethods(json).filter(method => methodName(method).startsWith(prefix) && method.tags && method.tags.find(tag => tag['x-provides'] === _interface))
}

function getProviderInterface(_interface, module) {
    module = JSON.parse(JSON.stringify(module))

    // TODO: localizeDependencies??
    const iface = getProviderInterfaceMethods(_interface, module).map(method => localizeDependencies(method, module, null, { mergeAllOfs: true }))
    
    if (iface.length && iface.every(method => methodName(method).startsWith('onRequest'))) {
        console.log(`Transforming legacy provider interface ${_interface}`)
        updateUnidirectionalProviderInterface(iface, module)
    }
    
    return iface
}

const capitalize = str => str.charAt(0).toUpperCase() + str.substr(1)

// This is getting called before downgrading the provider interfaces AND after... it can't work for both cases.
function getUnidirectionalProviderInterfaceName(_interface, capability, document = {}) {
    const iface = getProviderInterface(_interface, document)
    const [ module, method ] = iface[0].name.split('.')
    const uglyName = capability.split(":").slice(-2).map(capitalize).reverse().join('') + "Provider"
    let name = iface.length === 1 ? method.charAt(0).toUpperCase() + method.substr(1) + "Provider" : uglyName

    if (document.info['x-interface-names']) {
      name = document.info['x-interface-names'][capability] || name
    }
    return name
  }

function updateUnidirectionalProviderInterface(iface, module) {
    iface.forEach(method => {
        const payload = getPayloadFromEvent(method)
        const focusable = method.tags.find(t => t['x-allow-focus'])
    
        // remove `onRequest`
        method.name = methodRename(method, name => name.charAt(9).toLowerCase() + name.substr(10))

        const schema = getPropertySchema(payload, 'properties.parameters', module)
        
        method.params = [
          {
            "name": "parameters",
            "required": true,
            "schema": schema
          }
        ]
    
        // TODO: we used to say !extractProviderSchema, which CPP sets to true and therefor skips this. not sure why...
        if (true) {
          let exampleResult = null
  
          if (method.tags.find(tag => tag['x-response'])) {
            const result = method.tags.find(tag => tag['x-response'])['x-response']
    
            method.result = {
              "name": "result",
              "schema": result
            }
    
            if (result.examples && result.examples[0]) {
              exampleResult = result.examples[0]
            }
          }
          else {
            method.result = {
              "name": "result",
              "schema": {
                "const": null
              }
            }
          }
    
          method.examples = method.examples.map( example => (
            {
              params: [
                {
                  name: "parameters",
                  value: example.result.value.parameters
                },
                {
                    name: "correlationId",
                    value: example.result.value.correlationId
                }
              ],
              result: {
                name: "result",
                value: exampleResult
              }
            }
          ))
    
          // remove event tag
          method.tags = method.tags.filter(tag => tag.name !== 'event')
        }
      })
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

const isCallsMetricsMethod = compose(
    option(false),
    map(_ => true),
    chain(find(propEq('name', 'calls-metrics'))),
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

const isAllowFocusMethod = compose(
    option(false),
    map(_ => true),
    chain(find(and(
        hasProp('x-uses'),
        propSatisfies('x-allow-focus', focus => (focus === true))
    ))),
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

const getPayloadFromEvent = (event, client) => {
    try {
        if (event.result) {
            const choices = (event.result.schema.oneOf || event.result.schema.anyOf)
            if (choices) {
                const choice = choices.find(schema => schema.title !== 'ListenResponse' && !(schema['$ref'] || '').endsWith('/ListenResponse'))
                return choice        
            }
            else if (client) {
                const payload = getNotifier(event, client).params.slice(-1)[0].schema
                return payload
            }
            else {
                return event.result.schema
            }
        }
    }
    catch (error) {
        m(event)
        throw error
    }
}

const getSetterFor = (property, json) => json.methods && json.methods.find(m => m.tags && m.tags.find(t => t['x-setter-for'] === property))

const getSubscriberFor = (property, json) => json.methods.find(m => m.tags && m.tags.find(t => t['x-alternative'] === property))

const providerHasNoParameters = (schema) => {
    if (schema.allOf || schema.oneOf) {
        return !!(schema.allOf || schema.oneOf).find(schema => providerHasNoParameters(schema))
    }
    else if (schema.properties && schema.properties.params) {
        return isNull(schema.properties.params)
    }
    else {
        console.dir(schema, {depth: 10})
        console.log("Invalid ProviderRequest")
    }
}

const validEvent = and(
    pathSatisfies(['name'], isString),
    pathSatisfies(['name'], x => x.split('.').pop().match(/on[A-Z]/))
)

// Pick events out of the methods array
const getEvents = compose(
    option([]),
    map(filter(validEvent)),
    // Maintain the side effect of process.exit here if someone is violating the rules
    map(map(e => {
        if (!methodName(e).match(/on[A-Z]/)) {
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

const hasPublicInterfaces = json => json.methods && json.methods.filter(m => m.tags && m.tags.find(t=>t['x-provides'])).length > 0
const hasPublicAPIs = json => hasPublicInterfaces(json) || (json.methods && json.methods.filter( method => !method.tags.find(tag => tag.name === 'rpc-only')).length > 0)

const hasAllowFocusMethods = json => json.methods && json.methods.filter(m => isAllowFocusMethod(m)).length > 0

const eventDefaults = event => {

    event.tags = [
        {
            'name': 'notifier'
        }
    ]    

    return event
}

const createEventResultSchemaFromProperty = (property, type='Changed') => {
    const subscriberType = property.tags.map(t => t['x-subscriber-type']).find(t => typeof t === 'string') || 'context'

    const caps = property.tags.find(t => t.name === 'capabilities')
    let name = caps['x-provided-by'] ? caps['x-provided-by'].split('.').pop().replace('onRequest', '') : property.name
    name = name.charAt(0).toUpperCase() + name.substring(1)

    if ( subscriberType === 'global') { 
        // wrap the existing result and the params in a new result object
        const schema = {
            title: methodRename(property, name => name.charAt(0).toUpperCase() + name.substring(1) + type + 'Info').split('.').pop(),
            type: "object",
            properties: {

            },
            required: []
        }

        // add all of the params
        property.params.filter(p => p.name !== 'listen').forEach(p => {
            schema.properties[p.name] = p.schema
            schema.required.push(p.name)
        })

        // add the result (which might override a param of the same name)
        schema.properties[property.result.name] = property.result.schema
        !schema.required.includes(property.result.name) && schema.required.push(property.result.name)

        return schema
    }
}

const createNotifierFromProperty = (property, type='Changed') => {
    const subscriberType = property.tags.map(t => t['x-subscriber-type']).find(t => typeof t === 'string') || 'context'

    const notifier = JSON.parse(JSON.stringify(property))
    notifier.name = methodRename(notifier, name => name + type)

    Object.assign(notifier.tags.find(t => t.name.startsWith('property')), {
        name: 'notifier',
        'x-notifier-for': property.name,
        'x-event': methodRename(notifier, name => 'on' + name.charAt(0).toUpperCase() + name.substring(1))
    })

    if (subscriberType === 'global') {
        notifier.params = [
            {
                name: "info",
                schema: {
                    "$ref": "#/components/schemas/" + methodRename(notifier, name => name.charAt(0).toUpperCase() + name.substr(1) + 'Info')
                }
            }
        ]
    }
    else {
        notifier.params.push(notifier.result)
    }

    delete notifier.result    

    if (subscriberType === 'global') {
        notifier.examples = property.examples.map(example => ({
            name: example.name,
            params: [
                {
                    name: "info",
                    value: Object.assign(Object.fromEntries(example.params.map(p => [p.name, p.value])), Object.fromEntries([[example.result.name, example.result.value]]))
                }                    
            ]
        }))
    }
    else {
        notifier.examples.forEach(example => {
            example.params.push(example.result)
            delete example.result    
        })
    }

    return notifier
}

// create foo() notifier from onFoo() event
const createNotifierFromEvent = (event, json) => {
    const push = JSON.parse(JSON.stringify(event))
    const caps = push.tags.find(t => t.name === 'capabilities')
    push.name = caps['x-provided-by']
    delete caps['x-provided-by']
    
    caps['x-provides'] = caps['x-uses'].pop()
    delete caps['x-uses']

    push.tags = push.tags.filter(t => t.name !== 'event')

    push.result.required = true
    push.params.push(push.result)

    push.result = {
        "name": "result",
        "schema": {
            "type": "null"
        }
    }

    push.examples.forEach(example => {
        example.params.push(example.result)
        example.result = {
            "name": "result",
            "value": null
        }
    })

    return push
}

const createPullEventFromPush = (pusher, json) => {
    const event = JSON.parse(JSON.stringify(pusher))
    event.params = []
    event.name = methodRename(event, name => 'pull' + name.charAt(0).toUpperCase() + name.substr(1))
    const old_tags = pusher.tags.concat()
    event.tags = [
        {
            name: "notifier",
            'x-event': methodRename(pusher, name => 'onPull' + name.charAt(0).toUpperCase() + name.substr(1))
        }
    ]

    event.tags[0]['x-pulls-for'] = pusher.name
    event.tags.unshift({
        name: 'polymorphic-pull-event'
    })

    const requestType = methodRename(pusher, name => name.charAt(0).toUpperCase() + name.substr(1) + "FederatedRequest")
    event.params.push({
        name: "request",
        summary: "A " + requestType + " object.",
        schema: {
            "$ref": "#/components/schemas/" + requestType
        }
    })

    delete event.result

    const exampleResult = {
        name: "request",
        value: JSON.parse(JSON.stringify(getPathOr(null, ['components', 'schemas', requestType, 'examples', 0], json)))
    }

    event.examples && event.examples.forEach(example => {
        delete example.result
        example.params = [
            exampleResult
        ]
    })

    old_tags.forEach(t => {
        if (t.name !== 'polymorphic-pull' && t.name)
        {
            event.tags.push(t)
        }
    })

    return event
}

const createPullProvider = (requestor) => {
    const provider = JSON.parse(JSON.stringify(requestor))
    provider.name = requestor.tags.find(t => t['x-provided-by'])['x-provided-by']
    const old_tags = JSON.parse(JSON.stringify(requestor.tags))

    const caps = provider.tags.find(t => t.name === 'capabilities')
    caps['x-provides'] = caps['x-uses'].pop() || caps['x-manages'].pop()
    caps['x-requestor'] = requestor.name
    delete caps['x-uses']
    delete caps['x-manages']
    delete caps['x-provided-by']    

    return provider
}

const createPullProviderParams = (requestor) => {
    const copy = JSON.parse(JSON.stringify(requestor))

    // grab onRequest<foo> and turn into <foo>
    const name = copy.tags.find(t => t['x-provided-by'])['x-provided-by'].split('.').pop().substring(9)
    const paramsSchema = {
        "title": name.charAt(0).toUpperCase() + name.substr(1) + "ProviderParameters",
        "type": "object",
        "required": [],
        "properties": {
        },
        "additionalProperties": false
    }

    copy.params.forEach(p => {
        paramsSchema.properties[p.name] = p.schema
        if (p.required) {
            paramsSchema.required.push(p.name)
        }
    })

    return paramsSchema    
}

const createPullRequestor = (pusher, json) => {
    const module = pusher.tags.find(t => t.name === 'push-pull')['x-requesting-interface']
    const requestor = JSON.parse(JSON.stringify(pusher))
    requestor.name = (module ? module + '.' : '') + 'request' + requestor.name.charAt(0).toUpperCase() + requestor.name.substr(1)

    const value = requestor.params.pop()
    delete value.required

    requestor.tags = requestor.tags.filter(t => t.name !== 'push-pull')
    requestor.tags.unshift({
        "name": "requestor",
        "x-requestor-for": json.info.title + '.' + pusher.name
    })
    const caps = requestor.tags.find(t => t.name === 'capabilities')
    caps['x-provided-by'] = json.info.title + '.' + pusher.name
    caps['x-uses'] = [ caps['x-provides'] ]
    delete caps['x-provides']

    requestor.tags.find(t => t.name === 'capabilities')['x-provided-by'] = json.info.title + '.' + pusher.name
    requestor.result = value

    requestor.examples.forEach(example => {
        example.result = example.params.pop()
    })

    return requestor
}

const createTemporalEventMethod = (method, json, name) => {
    const event = createEventFromMethod(method, json, name, 'x-temporal-for', ['temporal-set'])

    // copy the array items schema to the main result for individual events
    event.result.schema = method.result.schema.items

    event.tags = event.tags.filter(t => t.name !== 'temporal-set')

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
    event.name = methodRename(event, _ => 'on' + name)
    const old_tags = JSON.parse(JSON.stringify(method.tags))

    event.tags[0][correlationExtension] = method.name
    event.tags.unshift({
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

    stop.name = methodRename(stop, name => 'stop' + name.charAt(0).toUpperCase() + name.substr(1))

    stop.tags = stop.tags.filter(tag => tag.name !== 'temporal-set')
    stop.tags.unshift({
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
    setter.name = methodRename(setter, name => 'set' + name.charAt(0).toUpperCase() + name.substr(1))
    const old_tags = setter.tags
    setter.tags = [
        {
            'name': 'setter',
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
            if (t.name === 'capabilities') {
                setter.tags.push({
                    name: 'capabilities',
                    'x-manages': t['x-uses'] || t['x-manages']
                })
            } else {
                setter.tags.push(t)
            }
        }
    })

    return setter
}

const createFocusFromProvider = provider => {
    
    const ready = JSON.parse(JSON.stringify(provider))
    ready.name = methodRename(ready, name => name.charAt(9).toLowerCase() + name.substr(10) + 'Focus')
    ready.summary = `Internal API for ${methodName(provider).substr(9)} Provider to request focus for UX purposes.`
    ready.tags = ready.tags.filter(t => t.name !== 'event')
    ready.tags.find(t => t.name === 'capabilities')['x-allow-focus-for'] = provider.name

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

    const response = JSON.parse(JSON.stringify(provider))
    response.name = methodRename(response, name => name.charAt(9).toLowerCase() + name.substr(10) + type)
    response.summary = `Internal API for ${methodName(provider).substr(9)} Provider to send back ${type.toLowerCase()}.`

    response.tags = response.tags.filter(t => t.name !== 'event')
    response.tags.find(t => t.name === 'capabilities')[`x-${type.toLowerCase()}-for`] = provider.name

    const paramExamples = []

    if (provider.tags.find(t => t[`x-${type.toLowerCase()}`])) {
        response.params = [
            {
                name: "correlationId",
                schema: {
                    type: "string"
                },
                required: true
            },
            {
                name: type === 'Error' ? 'error' : "result",
                schema: provider.tags.find(t => t[`x-${type.toLowerCase()}`])[`x-${type.toLowerCase()}`],
                required: true
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
                        name: 'correlationId',
                        value: '123'
                    },
                    {
                        name: 'result',
                        value: param
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
                        name: 'correlationId',
                        value: '123'
                    },
                    {
                        name: type === 'Error' ? 'error' : 'result',
                        value
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

const copyAllowFocusTags = (json) => {
    // for each allow focus provider method, set the value on any `use` methods that share the same capability
    json.methods.filter(m => m.tags.find(t => t['x-allow-focus'] && t['x-provides'])).forEach(method => {
        const cap = method.tags.find(t => t.name === "capabilities")['x-provides']
        json.methods.filter(m => m.tags.find(t => t['x-uses'] && t['x-uses'].includes(cap))).forEach(useMethod => {
            useMethod.tags.find(t => t.name === "capabilities")['x-allow-focus'] = true
        })
    })

    return json
}

const generatePropertyEvents = json => {
    const properties = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property')) || []
    const readonlies = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property:readonly')) || []

    properties.forEach(property => {
        json.methods.push(createNotifierFromProperty(property))
        const schema = createEventResultSchemaFromProperty(property)
        if (schema) {
            json.components.schemas[property.name.split('.').shift() + '.' + schema.title] = schema
        }
    })
    readonlies.forEach(property => {
        json.methods.push(createNotifierFromProperty(property))
        const schema = createEventResultSchemaFromProperty(property)
        if (schema) {
            json.components.schemas[property.name.split('.').shift() + '.' + schema.title] = schema
        }
    })

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

const generateProvidedByMethods = json => {
    const requestors = json.methods.filter(m => !m.tags.find(t => t.name === 'notifier')).filter( m => m.tags && m.tags.find( t => t['x-provided-by'])) || []

    requestors.forEach(requestor => {
        const provider = json.methods.find(m => (m.name === extension(requestor, 'x-provided-by')) && provides(m) && !isEvent(m) && !isPusher(m) && !isNotifier(m))
        if (!provider) {
            json.methods.push(createPullProvider(requestor))
        }
    })

    return json
}

const generateTemporalSetMethods = json => {
    const temporals = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'temporal-set')) || []

    temporals.forEach(temporal => json.methods.push(createTemporalEventMethod(temporal, json, (temporal.result.schema.items.title || 'Item') + 'Available')))
    temporals.forEach(temporal => json.methods.push(createTemporalEventMethod(temporal, json, (temporal.result.schema.items.title || 'Item') + 'Unavailable')))
    temporals.forEach(temporal => json.methods.push(createTemporalStopMethod(temporal, json)))

    return json
}


const generateUnidirectionalProviderMethods = json => {
    const providers = json.methods.filter(isProviderInterfaceMethod)// m => m.tags && m.tags.find( t => t.name == 'capabilities' && t['x-provides'] && !t['x-push'])) || []

    // Transform providers to legacy events
    providers.forEach(p => {
        const name = methodRename(p, name => 'onRequest' + name.charAt(0).toUpperCase() + name.substring(1))
        const prefix = name.split('.').pop().substring(9)

        json.methods.filter(m => m.tags && m.tags.find( t=> t.name === 'capabilities')['x-provided-by'] === p.name && !m.tags.find(t => t.name === 'notifier')).forEach(m => {
            m.tags.find(t => t.name === 'capabilities')['x-provided-by'] = name
        })
        p.name = name
        p.tags.push({
            name: 'event',
            'x-response-name': p.result.name,
            'x-response': p.result.schema,
            // todo: add examples
        })

        // Need to calculate if the module name ends with the same word as the method starts with, and dedupe
        // This is here because we're generating names that used to be editorial. These don't match exactly,
        // but they're good enough and "PinChallengeRequest" is way better than "PinChallengeChallengeRequest"
        let overlap = 0
        const _interface = p.name.split('.')[0]
        const method = methodName(p).substring(9)
        const capability = extension(p, 'x-provides')

        for (let i=0; i<Math.min(_interface.length, method.length); i++) {
            if (_interface.substring(_interface.length-i-1) === method.substring(0, i+1)) {
                overlap = i
            }
        }

        //const prefix = getUnidirectionalProviderInterfaceName(_interface, capability, json)//module.substring(0, module.length - overlap) + method

        // Build the parameters wrapper
        const parameters = {
            title: prefix + 'Parameters',
            type: "object",
            properties: {
                // actual params                
            },
            required: []
        }

        // add each param
        p.params.forEach(param => {
            parameters.properties[param.name] = param.schema
            if (param.required) {
                parameters.required.push(param.name)
            }
        })

        // remove them from the method
        p.params = []

        // build the request wrapper
        const request = {
            title: prefix + 'Request',
            type: "object",
            required: [
                "parameters",
                "correlationId"
            ],
            properties: {
                parameters: {
                    $ref: `#/components/schemas/${_interface}.${parameters.title}`
                },
                correlationId: {
                    type: "string"
                }
            },
            additionalProperties: false    
        }

        json.components.schemas[_interface + '.' + request.title] = request
        json.components.schemas[_interface + '.' + parameters.title] = parameters

        // Put the request into the new event's result
        p.result = {
            name: 'result',
            schema: {
                $ref: `#/components/schemas/${_interface}.${request.title}`
            }
        }

        const eventTag = p.tags.find(t => t.name === 'event')
        eventTag['x-response'].examples = []
        p.examples.forEach(example => {
            // transform examples
            eventTag['x-response'].examples.push(example.result.value)
            example.result = {
                name: 'result',
                value: {
                    correlationId: '1',
                    parameters: Object.fromEntries(example.params.map(p => [p.name, p.value]))
                }
            }
            example.params = [
                {
                    name: 'listen',
                    value: true
                }
            ]
        })
    })

    return json
}

const generateProviderMethods = (json) => {
    const providers = json.methods.filter(isProviderInterfaceMethod) || []

    providers.filter(p => methodName(p).startsWith('onRequest') && p.tags.find(t => t.name === 'event')).forEach(provider => {
        if (! isRPCOnlyMethod(provider)) {
            provider.tags.unshift({
                "name": "rpc-only"
            })
        }
        // only create the ready method for providers that require a handshake
        if (provider.tags.find(t => t['x-allow-focus'])) {
            json.methods.push(createFocusFromProvider(provider, json))
        }
    })

    providers.forEach(provider => {
        json.methods.push(createResponseFromProvider(provider, 'Response', json))
        json.methods.push(createResponseFromProvider(provider, 'Error', json))
    })

    return json
}

const generateEventSubscribers = json => {
    const notifiers = json.methods.filter( m => m.tags && m.tags.find(t => t.name == 'notifier')) || []

    notifiers.forEach(notifier => {
        const tag = notifier.tags.find(tag => tag.name === 'notifier')
        // if there's an x-event extension, this denotes an editorially created subscriber
        if (!tag['x-event']) {
            tag['x-event'] = methodRename(notifier, name => 'on' + name.charAt(0).toUpperCase() + name.substring(1))
        }
        const subscriber = json.methods.find(method => method.name === tag['x-event'])

        if (!subscriber) {
            const subscriber = JSON.parse(JSON.stringify(notifier))
            subscriber.name = methodRename(subscriber, name => 'on' + name.charAt(0).toUpperCase() + name.substring(1))
            subscriber.params.pop()
            subscriber.params.push({
                name: 'listen',
                schema: {
                    type: 'boolean'
                }
            })

            subscriber.result = {
                name: "result",
                schema: {
                    type: "null"
                }
            }

            subscriber.examples.forEach(example => {
                example.params.pop()
                example.params.push({
                    name: "listen",
                    value: true
                })
                example.result = {
                    name: "result",
                    value: null
                }
            })

            const tag = subscriber.tags.find(tag => tag.name === 'notifier')

            tag['x-notifier'] = notifier.name
            tag['x-subscriber-for'] = tag['x-notifier-for']
            tag.name = 'event'
            delete tag['x-notifier-for']
            delete tag['x-event']

            subscriber.result = {
                name: "result",
                schema: {
                    "type": "null"
                }
            }
            json.methods.push(subscriber)
        }
    })

    return json
}

const generateProviderRegistrars = json => {
    const interfaces = getInterfaces(json)

    interfaces.forEach(name => {
        const registration = json.methods.find(m => m.tags.find(t => t.name === 'registration') && extension(m, 'x-interface') === name)

        if (!registration) {
            json.methods.push({
                name: `${name}.provide`,
                tags: [
                    {
                        "name": "registration",
                        "x-interface": name
                    },
                    {
                        "name": "capabilities",
                        "x-provides": json.methods.find(m => m.name.startsWith(name) && m.tags.find(t => t.name === 'capabilities')['x-provides']).tags.find(t => t.name === 'capabilities')['x-provides']
                    }

                ],
                params: [
                    {
                        name: "enabled",
                        schema: {
                            type: "boolean"
                        }
                    }
                ],
                result: {
                    name: "result",
                    schema: {
                        type: "null"
                    }
                },
                examples: [
                    {
                        name: "Default example",
                        params: [
                            {
                                name: "enabled",
                                value: true
                            }
                        ],
                        result: {
                            name: "result",
                            value: null
                        }
                    }
                ]
            })
        }
    })

    return json
    const notifiers = json.methods.filter( m => m.tags && m.tags.find(t => t.name == 'notifier')) || []

    notifiers.forEach(notifier => {
        const tag = notifier.tags.find(tag => tag.name === 'notifier')
        // if there's an x-event extension, this denotes an editorially created subscriber
        if (!tag['x-event']) {
            tag['x-event'] = methodRename(notifier, name => 'on' + name.charAt(0).toUpperCase() +! name.substring(1))
        }
        const subscriber = json.methods.find(method => method.name === tag['x-event'])

        if (!subscriber) {
            const subscriber = JSON.parse(JSON.stringify(notifier))
            subscriber.name = methodRename(subscriber, name => 'on' + name.charAt(0).toUpperCase() + name.substring(1))
            subscriber.params.pop()
            subscriber.params.push({
                name: 'listen',
                schema: {
                    type: 'boolean'
                }
            })
            subscriber.tags.find(t => t.name === 'notifier')['x-notifier'] = notifier.name
            subscriber.tags.find(t => t.name === 'notifier').name = 'event'
            subscriber.result = {
                name: "result",
                schema: {
                    "type": "null"
                }
            }
            json.methods.push(subscriber)
        }
    })

    return json
}

const removeProviderRegistrars = (json) => {
    json.methods && (json.methods = json.methods.filter(m => !isRegistration(m)))
    return json
}

const generateUnidirectionalEventMethods = json => {
    const events = json.methods.filter( m => m.tags && m.tags.find(t => t.name == 'notifier')) || []

    events.forEach(event => {
        const tag = event.tags.find(t => t.name === 'notifier')
        event.name = tag['x-event'] || methodRename(event, n => 'on' + n.charAt(0).toUpperCase() + n.substr(1))
        delete tag['x-event']
        tag['x-subscriber-for'] = tag['x-notifier-for']
        delete tag['x-notifier-for']

        tag.name = 'event'
        event.result = event.params.pop()
        event.examples.forEach(example => {
            example.result = example.params.pop()
        })
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
            "$ref": "https://meta.rdkcentral.com/firebolt/schemas/types#/definitions/ListenResponse"
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

const getAnyOfSchema = (inType, json) => {
    let anyOfTypes = []
    let outType = localizeDependencies(inType, json)
    if (outType.schema.anyOf) {
        let definition = ''
        if (inType.schema['$ref'] && (inType.schema['$ref'][0] === '#')) {
            definition = getReferencedSchema(inType.schema['$ref'], json, json['x-schemas'])
        }
        else {
            definition = outType.schema
        }
        definition.anyOf.forEach(anyOf => {
            anyOfTypes.push(anyOf)
        })
        outType.schema.anyOf = anyOfTypes
    }
    return outType
}

const generateAnyOfSchema = (anyOf, name, summary) => {
    let anyOfType = {}
    anyOfType["name"] = name;
    anyOfType["summary"] = summary
    anyOfType["schema"] = anyOf
    return anyOfType
}

const generateParamsAnyOfSchema = (methodParams, anyOf, anyOfTypes, title, summary) => {
    let params = []
    methodParams.forEach(p => {
        if (p.schema.anyOf === anyOfTypes) {
            let anyOfType = generateAnyOfSchema(anyOf, p.name, summary)
            anyOfType.required = p.required
            params.push(anyOfType)
        }
        else {
            params.push(p)
        }
    })
    return params
}

const generateResultAnyOfSchema = (method, methodResult, anyOf, anyOfTypes, title, summary) => {
    let methodResultSchema = {}
    if (methodResult.schema.anyOf === anyOfTypes) {
        let anyOfType = generateAnyOfSchema(anyOf, title, summary)
        let index = 0
        if (isEventMethod(method)) {
            index = (method.result.schema.anyOf || method.result.schema.oneOf).indexOf(getPayloadFromEvent(method))
        }
        else {
            index = (method.result.schema.anyOf || method.result.schema.oneOf).indexOf(anyOfType)
        }
        if (method.result.schema.anyOf) {
            methodResultSchema["anyOf"] = Object.assign([], method.result.schema.anyOf)
            methodResultSchema.anyOf[index] = anyOfType.schema
        }
        else if (method.result.schema.oneOf) {
            methodResultSchema["oneOf"] = Object.assign([], method.result.schema.oneOf)
            methodResultSchema.oneOf[index] = anyOfType.schema
        }
        else {
            methodResultSchema = anyOfType.schema
        }
    }
    return methodResultSchema
}

const createPolymorphicMethods = (method, json) => {
    let anyOfTypes
    let methodParams = []
    let methodResult = Object.assign({}, method.result)

    method.params.forEach(p => {
        if (p.schema) {
            let param = getAnyOfSchema(p, json)
            if (param.schema.anyOf && anyOfTypes) {
                //anyOf is allowed with only one param in the params list
                throw `WARNING anyOf is repeated with param:${p}`
            }
            else if (param.schema.anyOf) {
                anyOfTypes = param.schema.anyOf
            }
            methodParams.push(param)
        }
    })
    let foundAnyOfParams = anyOfTypes ? true : false

    if (isEventMethod(method)) {
        methodResult.schema = getPayloadFromEvent(method)
    }
    methodResult = getAnyOfSchema(methodResult, json)
    let foundAnyOfResult = methodResult.schema.anyOf ? true : false
    if (foundAnyOfParams === true && foundAnyOfResult === true) {
        throw `WARNING anyOf is already with param schema, it is repeated with ${method.name} result too`
    }
    else if (foundAnyOfResult === true) {
        anyOfTypes = methodResult.schema.anyOf
    }
    let polymorphicMethodSchemas = []
    //anyOfTypes will be allowed either in any one of the params or in result
    if (anyOfTypes) {
        let polymorphicMethodSchema = {
            name: {},
            tags: {},
            summary: `${method.summary}`,
            params: {},
            result: {},
            examples: {}
        }
        anyOfTypes.forEach(anyOf => {

            let localized = localizeDependencies(anyOf, json)
            let title = localized.title || localized.name || ''
            let summary = localized.summary || localized.description || ''
            polymorphicMethodSchema.rpc_name = method.name
            polymorphicMethodSchema.name = foundAnyOfResult && isEventMethod(method) ? `${method.name}${title}` : method.name
            polymorphicMethodSchema.tags = method.tags
            polymorphicMethodSchema.params = foundAnyOfParams ? generateParamsAnyOfSchema(methodParams, anyOf, anyOfTypes, title, summary) : methodParams
            polymorphicMethodSchema.result = Object.assign({}, method.result)
            polymorphicMethodSchema.result.schema = foundAnyOfResult ? generateResultAnyOfSchema(method, methodResult, anyOf, anyOfTypes, title, summary) : methodResult.schema
            polymorphicMethodSchema.examples = method.examples
            polymorphicMethodSchemas.push(Object.assign({}, polymorphicMethodSchema))
        })
    }
    else {
      polymorphicMethodSchemas = method
    }

    return polymorphicMethodSchemas
}

const isSubSchema = (schema) => schema.type === 'object' || (schema.type === 'string' && schema.enum)
const isSubEnumOfArraySchema = (schema) => (schema.type === 'array' && schema.items.enum)

const addComponentSubSchemasNameForProperties = (key, schema) => {
  if ((schema.type === "object") && schema.properties) {
    Object.entries(schema.properties).forEach(([name, propSchema]) => {
      if (isSubSchema(propSchema)) {
        key = key + name.charAt(0).toUpperCase() + name.substring(1)
        if (!propSchema.title) {
          propSchema.title = key
        }
        propSchema = addComponentSubSchemasNameForProperties(key, propSchema)
      }
      else if (isSubEnumOfArraySchema(propSchema)) {
        key = key + name.charAt(0).toUpperCase() + name.substring(1)
        if (!propSchema.items.title) {
          propSchema.items.title = key
        }
      }
    })
  }

  return schema
}

const addComponentSubSchemasName = (obj, schemas) => {
    Object.entries(schemas).forEach(([key, schema]) => {
      let componentSchemaProperties = schema.allOf ? schema.allOf : [schema]
      componentSchemaProperties.forEach((componentSchema) => {
        key = key.charAt(0).toUpperCase() + key.substring(1)
        componentSchema = addComponentSubSchemasNameForProperties(key, componentSchema)
      })
    })

  return schemas
}

const promoteAndNameXSchemas = (obj) => {
  obj = JSON.parse(JSON.stringify(obj))
  if (obj['x-schemas']) {
    Object.entries(obj['x-schemas']).forEach(([name, schemas]) => {
      schemas = addComponentSubSchemasName(obj, schemas)
    })
  }
  return obj
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

const fireboltize = (json, bidirectional) => {
    json = generatePropertyEvents(json)
    json = generatePropertySetters(json)
    //  TODO: we don't use this yet... consider removing?
    //    json = generatePushPullMethods(json)
    json = generateProvidedByMethods(json)
    json = generatePolymorphicPullEvents(json)

    if (bidirectional) {
        console.log('Creating bidirectional APIs')
        json = generateEventSubscribers(json)
        json = generateProviderRegistrars(json)
        // generateInterfaceProviders
    }
    else {
        console.log('Creating uni-directional provider and event APIs')
        json = generateUnidirectionalProviderMethods(json)
        json = generateUnidirectionalEventMethods(json)
        json = generateProviderMethods(json)
        json = generateEventListenerParameters(json)
        json = generateEventListenResponse(json)
        json = removeProviderRegistrars(json)
    }

    json = generateTemporalSetMethods(json)
    json = copyAllowFocusTags(json)
    
    return json
}

const getExternalMarkdownPaths = obj => {
    return getExternalSchemaPaths(obj)
            .filter(x => /^file:/.test(getPathOr(null, x, obj)))
}  

const addExternalMarkdown = (data = {}, descriptions = {}) => {
    const paths = getExternalMarkdownPaths(data)
    paths.map(path => {
      const urn = getPathOr(null, path, data)
      const url = urn.indexOf("file:../") == 0 ? urn.substr("file:../".length) : urn.substr("file:".length)
      const markdownContent = descriptions[url]
      path.pop() // last element is expected to be `$ref`
      const field = path.pop() // relies on this position being the field name
      const objectNode = getPathOr(null, path, data)
      objectNode[field] = markdownContent // This mutates `data` by reference because JavaScript!
    })
    return data
}

// grab a schema from another file in this project (which must be loaded into the schemas parameter as Map<$id, json-schema-document>)
const getExternalPath = (uri = '', schemas = {}) => {
    if (!schemas) {
      return
    }
    
    const [mainPath, subPath] = uri.split('#')
    const json = schemas[mainPath] || schemas[mainPath + '/'] 
    
    // copy to avoid side effects
    let result
  
    try {
      result = JSON.parse(JSON.stringify(subPath ? getPathOr(null, subPath.slice(1).split('/'), json) : json))
    }
    catch (err) {
      console.log(`Error loading ${uri}`)
      console.log(err)
      process.exit(100)
    }
  
    return result
}

const getExternalSchemas = (json = {}, schemas = {}) => {
    // make a copy for safety!
    json = JSON.parse(JSON.stringify(json))
  
    let refs = getExternalSchemaPaths(json)
    const returnedSchemas = {}
    const unresolvedRefs = []
  
    while (refs.length > 0) {
      for (let i=0; i<refs.length; i++) {
        let path = refs[i]      
        const ref = getPathOr(null, path, json)
        path.pop() // drop ref
        let resolvedSchema = getExternalPath(ref, schemas)
        
        if (!resolvedSchema) {
          // rename it so the while loop ends
          throw "Unresolved schema: " + ref
        }
        // replace the ref so we can recursively grab more refs if needed...
        else if (path.length) {
          returnedSchemas[ref] = JSON.parse(JSON.stringify(resolvedSchema))
          // use a copy, so we don't pollute the returned schemas
          json = setPath(path, JSON.parse(JSON.stringify(resolvedSchema)), json)
        }
        else {
          delete json['$ref']
          Object.assign(json, resolvedSchema)
        }
      }
      refs = getExternalSchemaPaths(json)
    }
  
    return returnedSchemas
}

const addExternalSchemas = (json, sharedSchemas) => {
    json = JSON.parse(JSON.stringify(json))
    json.components = json.components || {}
    json.components.schemas = json.components.schemas || {}
    
    let found = true
    const added = []
    while (found) {
        const ids = getAllValuesForName('$ref', json)
        found = false
        Object.entries(sharedSchemas).forEach( ([key, schema], i) => {
            if (!added.includes(key)) {
                if (ids.find(id => id.startsWith(key))) {
                    const bundle = JSON.parse(JSON.stringify(schema))
                    replaceUri('', bundle.$id, bundle)
                    json.components.schemas[key] = bundle
                    added.push(key)
                    found = true
                }    
            }
        })
    }

//    json = removeUnusedSchemas(json)
    return json
}

// TODO: make this recursive, and check for group vs schema
const removeUnusedSchemas = (json) => {
    const schema = JSON.parse(JSON.stringify(json))
    const refs = getAllValuesForName('$ref', schema)

    const recurse = (schema, path) => {
        let deleted = false
        Object.keys(schema).forEach(name => {
            if (isSchema(schema[name])) {
                const used = refs.includes(path + '/' + name) || ((name.startsWith('https://') && refs.find(ref => ref.startsWith(name)))) //isDefinitionReferencedBySchema(path + '/' + name, json)
                if (!used) {
                    delete schema[name]
                    deleted = true
                }
                else {
                }
            }
            else if (typeof schema[name] === 'object') {
                deleted = deleted || recurse(schema[name], path + '/' + name)
            }
        })
        return deleted
    }

    if (schema.components.schemas) {
        while(recurse(schema.components.schemas, '#/components/schemas')) {
            refs.length = 0
            refs.push(...getAllValuesForName('$ref', schema))
        }
    }

    if (schema['x-schemas']) {
        while(recurse(schema['x-schemas'], '#/x-schemas')) {}
    }

    return schema
}

const removeUnusedBundles = (json) => {
    json = JSON.parse(JSON.stringify(json))
    // remove all the shared schemas
    const sharedSchemas = {}
    Object.keys(json.components.schemas).forEach (key => {
        if (key.startsWith('https://')) {
            sharedSchemas[key] = json.components.schemas[key]
            delete json.components.schemas[key]
        }
    })

    // and only add back in the ones that are still referenced
    let found = true
    while(found) {
        found = false
        const ids = [ ...new Set(getAllValuesForName('$ref', json).map(ref => ref.split('#').shift()))]
        Object.keys(sharedSchemas).forEach(key => {
            if (ids.includes(key)) {
                json.components.schemas[key] = sharedSchemas[key]
                delete sharedSchemas[key]
                found = true
            }
        })  
    }

    return json
}    

const getModule = (name, json, copySchemas, extractSubSchemas) => {
    
    // TODO: extractSubschemas was added by cpp branch, but that code is short-circuited out here...
    
    let openrpc = JSON.parse(JSON.stringify(json))
    openrpc.methods = openrpc.methods
                        .filter(method => method.name.toLowerCase().startsWith(name.toLowerCase() + '.'))
                        .filter(method => method.name !== 'rpc.discover') 
//                        .map(method => Object.assign(method, { name: method.name.split('.').pop() }))
    openrpc.info.title = name
    openrpc.components.schemas = Object.fromEntries(Object.entries(openrpc.components.schemas).filter( ([key, schema]) => key.startsWith('http') || key.split('.')[0] === name))
    if (json.info['x-module-descriptions'] && json.info['x-module-descriptions'][name]) {
        openrpc.info.description = json.info['x-module-descriptions'][name]
    }
    delete openrpc.info['x-module-descriptions']

    openrpc = promoteAndNameXSchemas(openrpc)
    return removeUnusedSchemas(openrpc)
    return removeUnusedBundles(removeUnusedSchemas(openrpc))
    
    const copy = JSON.parse(JSON.stringify(openrpc))

    // zap all of the schemas
    openrpc.components.schemas = {}
    openrpc['x-schemas'] = {}

    // and recursively search in the copy for referenced schemas until we have them all
    let searching = true
    while (searching) {
        searching = false
        getLocalSchemaPaths(openrpc).forEach(path => {
            const ref = getPathOr(null, path, copy) || getPathOr(null, path, openrpc)
            const parts = ref.substring(2).split('/')
            const schema = getPathOr(null, parts, copy)
            const uri = getPathOr(null, parts.filter((p, i, array) => i < array.length-1), copy).uri
            const destination = ref.substring(2).split('/')

            // Readability note - Value of destination[] is typically something like:
            //
            //   [ 'components', 'schemas', '<schema>' ] OR
            //   [ 'x-schemas', '<schema's document.title>', '<schema>' ]
            //
            // The code below uses destination[0] + destination[1] etc... so the names aren't hard coded

            // copy embedded schemas to the local schemas area if the flag is set
            if (uri && copySchemas) {
                // use '#/components/schemas/<name>' instead of '#/x-schemas/<group>/<name>'
                destination[0] = 'components'
                destination[1] = 'schemas'
                replaceRef(ref, ref.replace(/\/x-schemas\/[a-zA-Z]+\//, '/components/schemas/'), openrpc)
            }

            // only copy things that aren't already there
            if (schema && !getPathOr(null, destination, openrpc)) {
                // if we move over a schema, then we need at least one more run of the while loop
                searching = true
                // if copySchemas is off, then make sure we also grab the x-schema URI
                if (uri && !copySchemas) {
                    openrpc[destination[0]][destination[1]] = openrpc[destination[0]][destination[1]] || {}
                    openrpc[destination[0]][destination[1]][destination[2]] = {
                        uri: uri,
                        ...(openrpc[destination[0]][destination[1]][destination[2]] || {})
                    }    
                }
                const capitalize = str => str[0].toUpperCase() + str.substr(1)
                if (!schema.title) {
                    schema.title = capitalize(parts.pop())
                }

                openrpc = setPath(destination, schema, openrpc)
                if (extractSubSchemas) {
                    openrpc = promoteAndNameXSchemas(openrpc)
                }
            }
        })
    }

    return removeUnusedSchemas(openrpc)
}

const getClientModule = (name, client, server) => {

    const notifierFor = m => (m.tags.find(t => t['x-event']) || {})['x-event']
    const interfaces = server.methods.filter(m => m.tags.find(t => t['x-interface']))
                                        .map(m => m.tags.find(t => t['x-interface'])['x-interface'])

    let openrpc = JSON.parse(JSON.stringify(client))

    openrpc.methods = openrpc.methods
                        .filter(method => (notifierFor(method) && notifierFor(method).startsWith(name + '.') || interfaces.find(name => method.name.startsWith(name + '.'))))
    openrpc.info.title = name
    openrpc.components.schemas = Object.fromEntries(Object.entries(openrpc.components.schemas).filter( ([key, schema]) => key.startsWith('http') || key.split('.')[0] === name))
    if (client.info['x-module-descriptions'] && client.info['x-module-descriptions'][name]) {
        openrpc.info.description = client.info['x-module-descriptions'][name]
    }
    delete openrpc.info['x-module-descriptions']

    openrpc = promoteAndNameXSchemas(openrpc)
    return removeUnusedBundles(removeUnusedSchemas(openrpc))
}

const getSemanticVersion = json => {
    const str = json && json.info && json.info.version || '0.0.0-unknown.0'
    const version = {
        major: 0,
        minor: 0,
        patch: 0,
        build: undefined,
        tag: '',
        readable: 'Unknown version'
    }

    let numbers, rest

    if (str.indexOf('-') >= 0) {
        numbers = str.split('-')[0]
        rest = str.substring(str.indexOf('-')+1)
    }
    else {
        numbers = str
    }

//    [numbers, rest] = str.split('-')

    if (rest) {
        [version.tag, version.build] = (rest.indexOf('.') > -1) ? rest.split('.') : [rest, '']
    }

    [version.major, version.minor, version.patch] = numbers.split('.')
    version.readable = (json.info && json.info.title + ' ' || '')
    version.readable += version.major ? version.major : ''
    version.readable += version.minor ? '.' + version.minor : ''
    version.readable += version.patch ? '.' + version.patch : ''
    version.readable += version.tag ? '-' + version.tag : ''
    version.readable += version.build ? '.' + version.build : ''

    return version
}

export {
    isEnum,
    isEventMethod,
    isEventMethodWithContext,
    isPublicEventMethod,
    hasPublicAPIs,
    hasPublicInterfaces,
    isAllowFocusMethod,
    hasAllowFocusMethods,
    isPolymorphicReducer,
    isPolymorphicPullMethod,
    isTemporalSetMethod,
    isCallsMetricsMethod,
    isExcludedMethod,
    isRPCOnlyMethod,
    isProviderInterfaceMethod,
    hasExamples,
    hasTitle,
    hasMethodAttributes,
    getMethodAttributes,
    getMethods,
    getProviderInterface,
    getProvidedCapabilities,
    getProvidedInterfaces,
    getUnidirectionalProviderInterfaceName,
    getSetterFor,
    getSubscriberFor,
    getEnums,
    getTypes,
    getEvents,
    getPublicEvents,
    getSchemas,
    getParamsFromMethod,
    fireboltize,
    getPayloadFromEvent,
    getPathFromModule,
    providerHasNoParameters,
    removeUnusedSchemas,
    removeUnusedBundles,
    getModule,
    getClientModule,
    getSemanticVersion,
    addExternalMarkdown,
    addExternalSchemas,
    getExternalMarkdownPaths,
    createPolymorphicMethods
}
