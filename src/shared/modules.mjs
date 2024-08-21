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
import { getExternalSchemaPaths, isDefinitionReferencedBySchema, isNull, localizeDependencies, isSchema, getLocalSchemaPaths, replaceRef, getPropertySchema } from './json-schema.mjs'
import { getPath as getRefDefinition } from './json-schema.mjs'
const { isObject, isArray, propEq, pathSatisfies, hasProp, propSatisfies } = predicates

// TODO remove these when major/rpc branch is merged
const name = method => method.name.split('.').pop()
const rename = (method, renamer) => method.name.split('.').map((x, i, arr) => i === (arr.length-1) ? renamer(x) : x).join('.')

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

const isProviderInterfaceMethod = compose(
    and(
        compose(
            propSatisfies('name', name => name.startsWith('onRequest'))
        ),
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
            getPath(['tags'])        
        )
    )
  )

const getProvidedCapabilities = (json) => {
    return Array.from(new Set([...getMethods(json).filter(isProviderInterfaceMethod).map(method => method.tags.find(tag => tag['x-provides'])['x-provides'])]))
}

const getProviderInterfaceMethods = (capability, json) => {
    return getMethods(json).filter(method => method.name.startsWith("onRequest") && method.tags && method.tags.find(tag => tag['x-provides'] === capability))
}
  

function getProviderInterface(capability, module, extractProviderSchema = false) {
    module = JSON.parse(JSON.stringify(module))
    const iface = getProviderInterfaceMethods(capability, module)//.map(method => localizeDependencies(method, module, null, { mergeAllOfs: true }))
    
    iface.forEach(method => {
      const payload = getPayloadFromEvent(method)
      const focusable = method.tags.find(t => t['x-allow-focus'])
  
      // remove `onRequest`
      method.name = method.name.charAt(9).toLowerCase() + method.name.substr(10)

      const schema = getPropertySchema(payload, 'properties.parameters', module)
      
      method.params = [
        {
          "name": "parameters",
          "required": true,
          "schema": schema
        }
      ]
  
      if (!extractProviderSchema) {
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

    return iface
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

const getPayloadFromEvent = (event) => {
    const choices = (event.result.schema.oneOf || event.result.schema.anyOf)
    const choice = choices.find(schema => schema.title !== 'ListenResponse' && !(schema['$ref'] || '').endsWith('/ListenResponse'))
    return choice
}

const getSetterFor = (property, json) => json.methods && json.methods.find(m => m.tags && m.tags.find(t => t['x-setter-for'] === property))

const getSubscriberFor = (property, json) => json.methods.find(m => m.tags && m.tags.find(t => t['x-alternative'] === property))

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

const hasPublicInterfaces = json => json.methods && json.methods.filter(m => m.tags && m.tags.find(t=>t['x-provides'])).length > 0
const hasPublicAPIs = json => hasPublicInterfaces(json) || (json.methods && json.methods.filter( method => !method.tags.find(tag => tag.name === 'rpc-only')).length > 0)

const hasAllowFocusMethods = json => json.methods && json.methods.filter(m => isAllowFocusMethod(m)).length > 0

const eventDefaults = event => {

    event.tags = [
        {
            'name': 'event'
        }
    ]    

    return event
}

const createEventResultSchemaFromProperty = (property, type='') => {
    const subscriberType = property.tags.map(t => t['x-subscriber-type']).find(t => typeof t === 'string') || 'context'

    const caps = property.tags.find(t => t.name === 'capabilities')
    let name = caps['x-provided-by'] ? caps['x-provided-by'].split('.').pop().replace('onRequest', '') : property.name
    name = name.charAt(0).toUpperCase() + name.substring(1)

    if ( subscriberType === 'global') { 
        // wrap the existing result and the params in a new result object
        const schema = {
            title: name + type + 'Info',
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

const createEventFromProperty = (property, type='', alternative, json) => {
    const provider = (property.tags.find(t => t['x-provided-by']) || {})['x-provided-by']
    const pusher = provider ? provider.replace('onRequest', '').split('.').map((x, i, arr) => (i === arr.length-1) ? x.charAt(0).toLowerCase() + x.substr(1) : x).join('.') : undefined
    const event = eventDefaults(JSON.parse(JSON.stringify(property)))
//    event.name = (module ? module + '.' : '') + 'on' + event.name.charAt(0).toUpperCase() + event.name.substr(1) + type
    event.name = provider ? provider.split('.').pop().replace('onRequest', '') : event.name.charAt(0).toUpperCase() + event.name.substr(1) + type
    event.name = event.name.split('.').map((x, i, arr) => (i === arr.length-1) ? 'on' + x.charAt(0).toUpperCase() + x.substr(1) : x).join('.')
    const subscriberFor = pusher || (json.info.title + '.' + property.name)
    
    const old_tags = JSON.parse(JSON.stringify(property.tags))

    alternative && (event.tags[0]['x-alternative'] = alternative)

    !provider && event.tags.unshift({
        name: "subscriber",
        'x-subscriber-for': subscriberFor
    })

    const subscriberType = property.tags.map(t => t['x-subscriber-type']).find(t => typeof t === 'string') || 'context'
    
    // if the subscriber type is global, zap all of the parameters and change the result type to the schema that includes them
    if (subscriberType === 'global') {
        
        // wrap the existing result and the params in a new result object
        const result = {
            name: "data",
            schema: {
                $ref: "#/components/schemas/" + event.name.substring(2) + 'Info'
            }
        }

        event.examples.map(example => {
            const result = {}
            example.params.filter(p => p.name !== 'listen').forEach(p => {
                result[p.name] = p.value
            })
            result[example.result.name] = example.result.value
            example.params = example.params.filter(p => p.name === 'listen')
            example.result.name = "data"
            example.result.value = result
        })

        event.result = result
        
        // remove the params
        event.params = event.params.filter(p => p.name === 'listen')
    }

    old_tags.forEach(t => {
        if (t.name !== 'property' && !t.name.startsWith('property:') && t.name !== 'push-pull')
        {
            event.tags.push(t)
        }
    })

    provider && (event.tags.find(t => t.name === 'capabilities')['x-provided-by'] = subscriberFor)

    return event
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

const createPushEvent = (requestor, json) => {
    return createEventFromProperty(requestor, '', undefined, json)
}

const createPullEventFromPush = (pusher, json) => {
    const event = eventDefaults(JSON.parse(JSON.stringify(pusher)))
    event.params = []
    event.name = 'onPull' + event.name.charAt(0).toUpperCase() + event.name.substr(1)
    const old_tags = JSON.parse(JSON.stringify(pusher.tags))

    event.tags[0]['x-pulls-for'] = pusher.name
    event.tags.unshift({
        name: 'polymorphic-pull-event'
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
        example.params = []
    })

    old_tags.forEach(t => {
        if (t.name !== 'polymorphic-pull' && t.name)
        {
            event.tags.push(t)
        }
    })

    return event
}

const createPullProvider = (requestor, params) => {
    const event = eventDefaults(JSON.parse(JSON.stringify(requestor)))
    event.name = requestor.tags.find(t => t['x-provided-by'])['x-provided-by']
    const old_tags = JSON.parse(JSON.stringify(requestor.tags))

    const value = event.result

    event.tags[0]['x-response'] = value.schema
    event.tags[0]['x-response'].examples = event.examples.map(e => e.result.value)

    event.result = {
        "name": "request",
        "schema": {
            "type": "object",
            "required": ["correlationId", "parameters"],
            "properties":{
                "correlationId": {
                    "type": "string",
                },
                "parameters": {
                    "$ref": "#/components/schemas/" + params
                }
            },
            "additionalProperties": false
        }
    }

    event.params = []

    event.examples = event.examples.map(example => {
        example.result = {
            "name": "request",
            "value": {
                "correlationId": "xyz",
                "parameters": {}
            }                
        }
        example.params.forEach(p => {
            example.result.value.parameters[p.name] = p.value
        })
        example.params = []
        return example
    })

    old_tags.forEach(t => {
        if (t.name !== 'push-pull')
        {
            event.tags.push(t)
        }
    })

    const caps = event.tags.find(t => t.name === 'capabilities')
    caps['x-provides'] = caps['x-uses'].pop() || caps['x-manages'].pop()
    caps['x-requestor'] = requestor.name
    delete caps['x-uses']
    delete caps['x-manages']
    delete caps['x-provided-by']    

    return event
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
    event.name = 'on' + name
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

    stop.name = 'stop' + method.name.charAt(0).toUpperCase() + method.name.substr(1)

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
    setter.name = 'set' + setter.name.charAt(0).toUpperCase() + setter.name.substr(1)
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

    if (!name(provider).startsWith('onRequest')) {
        throw "Methods with the `x-provider` tag extension MUST start with 'onRequest'."
    }
    
    const ready = JSON.parse(JSON.stringify(provider))
    ready.name = rename(ready, n => n.charAt(9).toLowerCase() + n.substr(10) + 'Focus')
    ready.summary = `Internal API for ${name(provider).substr(9)} Provider to request focus for UX purposes.`
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

    if (!name(provider).startsWith('onRequest')) {
        throw "Methods with the `x-provider` tag extension MUST start with 'onRequest'."
    }

    const response = JSON.parse(JSON.stringify(provider))
    response.name = rename(response, n => n.charAt(9).toLowerCase() + n.substr(10) + type)
    response.summary = `Internal API for ${provider.name.substr(9)} Provider to send back ${type.toLowerCase()}.`

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
        json.methods.push(createEventFromProperty(property, 'Changed', property.name, json))
        const schema = createEventResultSchemaFromProperty(property, 'Changed')
        if (schema) {
            json.components.schemas[schema.title] = schema
        }
    })
    readonlies.forEach(property => {
        json.methods.push(createEventFromProperty(property, 'Changed', property.name, json))
        const schema = createEventResultSchemaFromProperty(property, 'Changed')
        if (schema) {
            json.components.schemas[schema.title] = schema
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

const generatePushPullMethods = json => {
    const requestors = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'push-pull')) || []
    requestors.forEach(requestor => {
        json.methods.push(createPushEvent(requestor, json))
        
        const schema = createEventResultSchemaFromProperty(requestor)
        if (schema) {
            json.components = json.components || {}
            json.components.schemas = json.components.schemas || {}
            json.components.schemas[schema.title] = schema
        }        
    })

    return json
}

const generateProvidedByMethods = json => {
    const requestors = json.methods.filter(m => !m.tags.find(t => t.name === 'event')).filter( m => m.tags && m.tags.find( t => t['x-provided-by'])) || []
    const events = json.methods .filter(m => m.tags.find(t => t.name === 'event'))
                                .filter( m => m.tags && m.tags.find( t => t['x-provided-by']))
                                .filter(e => !json.methods.find(m => m.name === e.tags.find(t => t['x-provided-by'])['x-provided-by']))

    const pushers = events.map(m => createNotifierFromEvent(m, json))
    pushers.forEach(m => json.methods.push(m))

    requestors.forEach(requestor => {
        const schema = createPullProviderParams(requestor)
        json.methods.push(createPullProvider(requestor, schema.title))

        json.components = json.components || {}
        json.components.schemas = json.components.schemas || {}
        json.components.schemas[schema.title] = schema
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


const generateProviderMethods = json => {
    const providers = json.methods.filter( m => name(m).startsWith('onRequest') && m.tags && m.tags.find( t => t.name == 'capabilities' && t['x-provides'])) || []

    providers.forEach(provider => {
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

const getAnyOfSchema = (inType, json) => {
    let anyOfTypes = []
    let outType = localizeDependencies(inType, json)
    if (outType.schema.anyOf) {
        let definition = ''
        if (inType.schema['$ref'] && (inType.schema['$ref'][0] === '#')) {
            definition = getRefDefinition(inType.schema['$ref'], json, json['x-schemas'])
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

const fireboltize = (json) => {
    json = generatePropertyEvents(json)
    json = generatePropertySetters(json)
    //  TODO: we don't use this yet... consider removing?
    //    json = generatePushPullMethods(json)
    //    json = generateProvidedByMethods(json)
    json = generatePolymorphicPullEvents(json)
    json = generateProviderMethods(json)
    json = generateTemporalSetMethods(json)
    json = generateEventListenerParameters(json)
    json = generateEventListenResponse(json)
    
    return json
}

const fireboltizeMerged = (json) => {
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

    let searching = true

    while (searching) {
        searching = false
        const externalSchemas = getExternalSchemas(json, sharedSchemas)
        Object.entries(externalSchemas).forEach( ([name, schema]) => {
            const group = sharedSchemas[name.split('#')[0]].title
            const id = sharedSchemas[name.split('#')[0]].$id
            const refs = getLocalSchemaPaths(schema)
            refs.forEach(ref => {
                ref.pop() // drop the actual '$ref' so we can modify it
                getPathOr(null, ref, schema).$ref = id + getPathOr(null, ref, schema).$ref
            })
            // if this schema is a child of some other schema that will be copied in this batch, then skip it
            if (Object.keys(externalSchemas).find(s => name.startsWith(s+'/') && s.length < name.length)) {
                console.log('Skipping: ' + name)
                console.log('Because of: ' + Object.keys(externalSchemas).find(s => name.startsWith(s) && s.length < name.length))
                throw "Skipping sub schema"
                return
            }
            searching = true
            json['x-schemas'] = json['x-schemas'] || {}
            json['x-schemas'][group] = json['x-schemas'][group] || { uri: name.split("#")[0]}
            json['x-schemas'][group][name.split("/").pop()] = schema
        })
    
        //update references to external schemas to be local
        Object.keys(externalSchemas).forEach(ref => {
          const group = sharedSchemas[ref.split('#')[0]].title
          replaceRef(ref, `#/x-schemas/${group}/${ref.split("#").pop().substring('/definitions/'.length)}`, json)
        })    
    }

    return json
}

// TODO: make this recursive, and check for group vs schema
const removeUnusedSchemas = (json) => {
    const schema = JSON.parse(JSON.stringify(json))

    const recurse = (schema, path) => {
        let deleted = false
        Object.keys(schema).forEach(name => {
            if (isSchema(schema[name])) {
                const used = isDefinitionReferencedBySchema(path + '/' + name, json)

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
        while(recurse(schema.components.schemas, '#/components/schemas')) {}
    }

    if (schema['x-schemas']) {
        while(recurse(schema['x-schemas'], '#/x-schemas')) {}
    }

    return schema
}

const getModule = (name, json, copySchemas, extractSubSchemas) => {
    let openrpc = JSON.parse(JSON.stringify(json))
    openrpc.methods = openrpc.methods
                        .filter(method => method.name.toLowerCase().startsWith(name.toLowerCase() + '.'))
                        .map(method => Object.assign(method, { name: method.name.split('.').pop() }))
    openrpc.info.title = name
    if (json.info['x-module-descriptions'] && json.info['x-module-descriptions'][name]) {
        openrpc.info.description = json.info['x-module-descriptions'][name]
    }
    delete openrpc.info['x-module-descriptions']
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
    getSetterFor,
    getSubscriberFor,
    getEnums,
    getTypes,
    getEvents,
    getPublicEvents,
    getSchemas,
    getParamsFromMethod,
    fireboltize,
    fireboltizeMerged,
    getPayloadFromEvent,
    getPathFromModule,
    providerHasNoParameters,
    removeUnusedSchemas,
    getModule,
    getSemanticVersion,
    addExternalMarkdown,
    addExternalSchemas,
    getExternalMarkdownPaths,
    createPolymorphicMethods
}
