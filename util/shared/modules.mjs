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
import path from 'path'
const { tap, compose, getPathOr } = helpers
import safe from 'crocks/Maybe/safe.js'
import find from 'crocks/Maybe/find.js'
import getPath from 'crocks/Maybe/getPath.js'
import pointfree from 'crocks/pointfree/index.js'
const { chain, filter, option, map, reduce } = pointfree
import logic from 'crocks/logic/index.js'
const { and, not } = logic
import isString from 'crocks/core/isString.js'
import predicates from 'crocks/predicates/index.js'
const { isObject, isArray, propEq, pathSatisfies } = predicates
import { fsReadFile, bufferToString } from './helpers.mjs'
import { getSchemaContent } from './json-schema.mjs'

const modules = {}

// overriden by /version.json
const version = {
    major: 0,
    minor: 0,
    patch: 0,
    readable: 'v0.0.0'
}

// Version MUST be global across all modules, it's set here
const setVersion = v => Object.assign(version, v)
const getVersion = () => version

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

const getSchemasAndFixTitles = compose(
    option([]),
    chain(safe(isArray)),
    map(map(addMissingTitles)),
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

const addModule = obj => {
    if (obj && obj.info && obj.info.title) {
        modules[obj.info.title] = obj
    }
}

const getAllModules = _ => {
    return Object.values(modules)
}

const createEventFromProperty = property => {
    const event = JSON.parse(JSON.stringify(property))
    event.name = 'on' + event.name.charAt(0).toUpperCase() + event.name.substr(1) + 'Changed'
    const old_tags = event.tags
    event.tags = [
        {
            'name': 'event'
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

    old_tags.forEach(t => {
        if (t.name !== 'property' && !t.name.startsWith('property:'))
        {
            event.tags.push(t)
        }
    })

    return event
}

const generateEvents = json => {
    const properties = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property')) || []
    const readonlies = json.methods.filter( m => m.tags && m.tags.find( t => t.name == 'property:readonly')) || []

    properties.forEach(property => json.methods.push(createEventFromProperty(property)))
    readonlies.forEach(property => json.methods.push(createEventFromProperty(property)))

    return json
}

// A through stream that expects a stream of filepaths, reads the contents
// of any .json files found, and converts them to POJOs
// DOES NOT DEAL WITH ERRORS
const getModuleContent = x => getSchemaContent(x).map(generateEvents)

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
    isExcludedMethod,
    isRPCOnlyMethod,
    hasExamples,
    hasTitle,
    getMethods,
    getEnums,
    getTypes,
    getEvents,
    getPublicEvents,
    getSchemas,
    getParamsFromMethod,
    setVersion,
    getVersion,
    addModule,
    getModuleContent,
    getAllModules,
    getPathFromModule
}