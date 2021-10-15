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

import { isExcludedMethod, isRPCOnlyMethod } from '../../shared/modules.mjs'
import { getTemplate, getTemplateForMethod } from '../../shared/template.mjs'
import { getMethodSignatureParams } from '../../shared/javascript.mjs'

const staticModules = []

const aggregateMacros = {
  exports: '',
  mockImports: '',
  mockObjects: ''
}

// overriden by /version.json
const version = {
  major: 0,
  minor: 0,
  patch: 0,
  readable: 'v0.0.0'
}

// util for visually debugging crocks ADTs
const inspector = obj => {
  if (obj.inspect) {
    console.log(obj.inspect())
  } else {
    console.log(obj)
  }
}

// Version MUST be global across all modules, it's set here
const setVersion = v => Object.assign(version, v)

// Maybe methods array of objects
const getMethods = compose(
  map(filter(isObject)),
  chain(safe(isArray)),
  getPath(['methods'])
)

const addStaticModule = (m) => { staticModules.push(m) }

// Maybe an array of <key, value> from the schema
const getSchemas = compose(
  map(Object.entries), // Maybe Array<Array<key, value>>
  chain(safe(isObject)), // Maybe Object
  getPath(['components', 'schemas']) // Maybe any
)

const isCallMetricsMethod = compose(
  option(false),
  map(_ => true),
  chain(find(propEq('name', 'calls-metrics'))),
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

const isEventMethod = compose(
  option(false),
  map(_ => true),
  chain(find(propEq('name', 'event'))),
  getPath(['tags'])
)

const isPolymorphicReducer = compose(
  option(false),
  map(_ => true),
  chain(find(propEq('name', 'polymorphic-reducer'))),
  getPath(['tags'])
)

const methodHasExamples = compose(
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
const eventsOrEmptyArray = compose(
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
  map(filter(isPublicEventMethod)),
  getMethods
)

const getMethodsThatCallMetrics = compose(
  option([]),
  map(filter(isCallMetricsMethod)),
  getMethods
)

const getModuleName = json => {
  return json ? (json.title || (json.info ? json.info.title : 'Unknown')) : 'Unknown'
}

const makeEventName = x => x.name[2].toLowerCase() + x.name.substr(3) // onFooBar becomes fooBar

//import { default as platform } from '../Platform/defaults'
const generateAggregateMacros = obj => {
  aggregateMacros.exports += `export { default as ${getModuleName(obj)} } from './${getModuleName(obj)}'\n`
  aggregateMacros.mockImports += `import { default as ${getModuleName(obj).toLowerCase()} } from '../${getModuleName(obj)}/defaults'\n`
  aggregateMacros.mockObjects += `  ${getModuleName(obj).toLowerCase()}: ${getModuleName(obj).toLowerCase()},\n`
}

const generateMacros = obj => {
  generateAggregateMacros(obj)
  const imports = generateImports(obj)
  const initialization = generateInitialization(obj)
  const enums = generateEnums(obj)
  const events = generateEvents(obj)
  const methods = generateMethods(obj)
  const methodList = generateMethodList(obj)
  const onlyEventMethods = generateMethods(obj, true)
  const defaults = generateDefaults(obj)
  const macros = {
    imports,
    initialization,
    enums,
    events,
    methods,
    methodList,
    onlyEventMethods,
    defaults,
  }
  return [macros, obj]
}

const insertAggregateMacrosOnly = fContents => {
  let m
  while (m = staticModules.shift()) {
    generateAggregateMacros({ title: m })
  }

  fContents = fContents.replace(/[ \t]*\/\* \$\{EXPORTS\} \*\/[ \t]*\n/, aggregateMacros.exports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_IMPORTS\} \*\/[ \t]*\n/, aggregateMacros.mockImports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_OBJECTS\} \*\/[ \t]*\n/, aggregateMacros.mockObjects)
  return fContents
}

const insertMacros = ([file, fContents, macros, obj]) => {
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHODS\} \*\/[ \t]*\n/, macros.methods)
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHOD_LIST\} \*\/[ \t]*\n/, macros.methodList)
  fContents = fContents.replace(/[ \t]*\/\* \$\{ENUMS\} \*\/[ \t]*\n/, macros.enums)
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENTS\} \*\/[ \t]*\n/, macros.events)
  fContents = fContents.replace(/[ \t]*\/\* \$\{IMPORTS\} \*\/[ \t]*\n/, macros.imports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{INITIALIZATION\} \*\/[ \t]*\n/, macros.initialization)
  fContents = fContents.replace(/[ \t]*\/\* \$\{DEFAULTS\} \*\/[ \t]*\n/, macros.defaults)
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENT_METHODS\} \*\/[ \t]*\n/, macros.onlyEventMethods)

  fContents = insertAggregateMacrosOnly(fContents)

  fContents = fContents.replace(/\$\{readable\}/g, version.readable)
  fContents = fContents.replace(/\$\{major\}/g, version.major)
  fContents = fContents.replace(/\$\{minor\}/g, version.minor)
  fContents = fContents.replace(/\$\{patch\}/g, version.patch)

  const exampleMatches = [...fContents.matchAll(/0 \/\* \$\{EXAMPLE\:(.*?)\} \*\//g)]
  const findCorrespondingMethodExample = methods => match => compose(
    option(''),
    map(JSON.stringify),
    chain(getPath(['examples', 0, 'result', 'value'])),
    chain(find(propEq('name', match[1]))),
  )(methods)
  
  // Here there be side-effects.
  exampleMatches.forEach((match) => {
    fContents = fContents.replace(match[0], findCorrespondingMethodExample(getMethods(obj))(match))
  })

  return [file, fContents]
}

const enumReducer = (acc, val, i, arr) => {
  const keyName = val.replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()
  acc = acc + `    ${keyName}: '${val}'`
  if (i < arr.length-1) {
    acc = acc.concat(',\n')
  }
  return acc
}

const enumBuilder = map(x => {
  const enumLines = x.enum.reduce(enumReducer, '')
  return `
  ${x.title}: \{
${enumLines}
  \},
`
})

const enumFinder = compose(
  filter(x => x.type === 'string' && Array.isArray(x.enum) && x.title),
  map(([_, val]) => val),
  filter(([_key, val]) => isObject(val))
)

const generateEnums  = compose(
  option(''), // Fallback
  map(reduce((acc, val) => acc.concat(val).concat('\n'), '')),
  map(enumBuilder), // Maybe Array<str>
  map(enumFinder), // Maybe Array<Object>
  getSchemas // Maybe Array<Array<key, val>>
)

const generateEvents = compose(
  reduce((acc, val, i, arr) => {
    if (i === 0) {
      acc = acc.concat('  events: {\n')
    }
    acc = `${acc}    ${val}:'${val}'`
    if (i < arr.length-1) {
      acc = acc.concat(',\n')
    } else {
      acc = acc.concat('\n  },\n')
    }
    return acc
  }, ''),
  map(makeEventName),
  eventsOrEmptyArray
)

const generateDefaults = compose(
  reduce((acc, val, i, arr) => {
    acc += `
${val.name}: ${JSON.stringify(val.examples[0].result.value, null, '  ')}`
    if (i < arr.length-1) {
      acc = acc.concat(',\n')
    } else {
      acc = acc.concat('\n')
    }
    return acc
  }, ''),
  compose(
    option([]),
    map(filter(and(not(isEventMethod), methodHasExamples))),
    getMethods
  )
)

const generateImports = json => {
  let imports = ''

  if (eventsOrEmptyArray(json).length) {
    imports += `import Events from '../Events'\n`
    imports += `import { registerEvents } from \'../Events\'\n`
  }

  return imports
}

const generateInitialization = json => compose(
  reduce((acc, method, i, arr) => {
    if (i === 0) {
      acc = []
    }
    acc.push(makeEventName(method))
    if (i < arr.length-1) {
      return acc  
    }
    return `
registerEvents('${getModuleName(json)}', Object.values(${JSON.stringify(acc)}))\n`
    }, ''),
  eventsOrEmptyArray
)(json)

function generateMethodList(json = {}) {
  const notEventMethods = compose(
    option([]),
    map(filter(not(isEventMethod))),
    map(filter(not(isRPCOnlyMethod))),
    map(filter(not(isExcludedMethod))),
    getMethods
  )(json)
  const eventMethods = eventsOrEmptyArray(json)

  let result = notEventMethods.map(m => m.name).join(',\n  ')
  if (eventMethods.length) {
    result += ',\n  listen,\n  once,\n  clear'
  }

  return result
}

function generateMethods(json = {}, onlyEvents = false) {
  const moduleName = getModuleName(json).toLowerCase()
  
  // Two arrays that represent two codegen flows
  const eventMethods = eventsOrEmptyArray(json)
  const notEventMethods = compose(
    option([]),
    map(filter(not(isEventMethod))),
    map(filter(not(isRPCOnlyMethod))),
    map(filter(not(isExcludedMethod))),
    getMethods
  )(json)

  // Builds [ARGS, PARAMS] strings for use in the function templates.
  // I went with accumulating the 2 values over the same loop to avoid
  // doing it twice.
  const paramsReducer = (acc, val, i, arr) => {
    let [argAcc, paramAcc] = acc
    if (i === 0) {
      paramAcc = paramAcc.concat(', {')
    }
    paramAcc = paramAcc.concat(`${val.name}:${val.name}`)
    argAcc = argAcc.concat(`${val.name}`)
    if (i < arr.length-1) {
      paramAcc = paramAcc.concat(', ')
      argAcc = argAcc.concat(', ')
    } else {
      paramAcc = paramAcc.concat('}')
    }
    return [argAcc, paramAcc]
  }
  const buildArgsAndParams = reduce(paramsReducer, ['', ''])

  // Code to generate for methods that ARE NOT events.
  const nonEventMethodReducer = reduce((acc, methodObj, i, arr) => {
//      const params = getParamsFromMethod(methodObj)
//      const [ARGS, PARAMS] = buildArgsAndParams(params)

      const info = {
        title: moduleName
      }
      const method = {
        name: methodObj.name,
        params: getMethodSignatureParams(moduleName, methodObj, { isInterface: false })
      }

      const template = getTemplateForMethod(methodObj)
      const javascript = template.replace(/\$\{method\.name\}/g, method.name)
        .replace(/\$\{method\.params\}/g, method.params)
        .replace(/\$\{method\.Name\}/g, method.name[0].toUpperCase() + method.name.substr(1))
        .replace(/\$\{info\.title\}/g, info.title)

      acc = acc.concat(javascript)

      // Do this regardless
      acc = acc.concat('\n')
      return acc
    }, '', notEventMethods)

  // Code to generate for methods that ARE events
  const eventMethodReducer = reduce((_) => {
    return `
function listen(...args) {
  return Events.listen('${moduleName}', ...args)
} 

function once(...args) {
  return Events.once('${moduleName}', ...args)
}

function clear(...args) {
  return Events.clear('${moduleName}', ...args)
}
`
  }, '', eventMethods)
  
  if (onlyEvents) {
    return eventMethodReducer
  }
  return nonEventMethodReducer.concat(eventMethodReducer)
}

const generateTopIndex = _ => {
  modules
}

export {
  setVersion,
  addStaticModule,
  generateMacros,
  insertMacros,
  insertAggregateMacrosOnly,
  generateEvents,
  generateDefaults,
  generateEnums,
  generateMethods,
  generateImports,
  generateInitialization
}