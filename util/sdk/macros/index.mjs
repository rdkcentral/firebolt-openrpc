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
const { chain, filter, option, map, reduce, concat } = pointfree
import logic from 'crocks/logic/index.js'
const { and, not, or } = logic
import isString from 'crocks/core/isString.js'
import predicates from 'crocks/predicates/index.js'
import isNil from 'crocks/core/isNil.js'
const { isObject, isArray, propEq, pathSatisfies, propSatisfies } = predicates

import { isExcludedMethod, isRPCOnlyMethod, isProviderMethod, getPayloadFromEvent, providerHasNoParameters, isTemporalSetMethod, hasMethodAttributes, getMethodAttributes } from '../../shared/modules.mjs'
import { getTemplateForMethod } from '../../shared/template.mjs'
import { getMethodSignatureParams } from '../../shared/javascript.mjs'
import isEmpty from 'crocks/core/isEmpty.js'
import { localizeDependencies } from '../../shared/json-schema.mjs'

// util for visually debugging crocks ADTs
const _inspector = obj => {
  if (obj.inspect) {
    console.log(obj.inspect())
  } else {
    console.log(obj)
  }
}

// Maybe methods array of objects
const getMethods = compose(
  map(filter(isObject)),
  chain(safe(isArray)),
  getPath(['methods'])
)

// Maybe an array of <key, value> from the schema
const getSchemas = compose(
  map(Object.entries), // Maybe Array<Array<key, value>>
  chain(safe(isObject)), // Maybe Object
  getPath(['components', 'schemas']) // Maybe any
)

// TODO: import from shared/modules.mjs
const isDeprecatedMethod = compose(
  option(false),
  map(_ => true),
  chain(find(propEq('name', 'deprecated'))),
  getPath(['tags'])
)

// TODO: import from shared/modules.mjs
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
    chain(
      find(
        and(
          propEq('name', 'event'),
          propSatisfies('x-provides', isEmpty)
        )
      )
    ),
    getPath(['tags'])
  )
)

// TODO: import from shared/modules.mjs
const isEventMethod = compose(
  option(false),
  map(_ => true),
  chain(find(propEq('name', 'event'))),
  getPath(['tags'])
)

const isSynchronousMethod = compose(
  option(false),
  map(_ => true),
  chain(find(propEq('name', 'synchronous'))),
  getPath(['tags'])
)

const methodHasExamples = compose(
  option(false),
  map(isObject),
  getPath(['examples', 0])
)

const validEvent = and(
  pathSatisfies(['name'], isString),
  pathSatisfies(['name'], x => x.match(/on[A-Z]/))
)

const hasTag = (method, tag) => {
  return method.tags && method.tags.filter(t => t.name === tag).length > 0
}

const isPropertyMethod = (m) => {
  return hasTag(m, 'property') || hasTag(m, 'property:immutable') || hasTag(m, 'property:readonly')
}

// Pick methods that call RCP out of the methods array
const rpcMethodsOrEmptyArray = compose(
  option([]),
  map(filter(not(isSynchronousMethod))),
  getMethods
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

const temporalSets = compose(
  option([]),
  map(filter(isTemporalSetMethod)),
  getMethods  
)

const methodsWithXMethodsInResult = compose(
  option([]),
  map(filter(hasMethodAttributes)),
  getMethods  
)

// Find all provided capabilities
const providedCapabilitiesOrEmptyArray = compose(
  option([]),
  map(caps => [... new Set(caps)]),
  map(map(m => m.tags.find(t => t['x-provides'])['x-provides'])), // grab the capabilty it provides
  map(filter(isProviderMethod)),
  getMethods
)

// Pick providers out of the methods array
const providersOrEmptyArray = compose(
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
  map(filter(isProviderMethod)),
  getMethods
)

// Pick deprecated methods out of the methods array
const deprecatedOrEmptyArray = compose(
  option([]),
  map(filter(isDeprecatedMethod)),
  getMethods
)

const props = compose(
  option([]),
  map(filter(m => isPropertyMethod(m))),
  getMethods
)

const getModuleName = json => {
  return json ? (json.title || (json.info ? json.info.title : 'Unknown')) : 'Unknown'
}

const makeEventName = x => x.name[2].toLowerCase() + x.name.substr(3) // onFooBar becomes fooBar
const makeProviderMethod = x => x.name["onRequest".length].toLowerCase() + x.name.substr("onRequest".length + 1) // onRequestChallenge becomes challenge

//import { default as platform } from '../Platform/defaults'
const generateAggregateMacros = (modules = {}) => Object.values(modules)
  .reduce((acc, module) => {
    acc.exports += `export { default as ${getModuleName(module)} } from './${getModuleName(module)}/index.mjs'\n`
    acc.mockImports += `import { default as ${getModuleName(module).toLowerCase()} } from './${getModuleName(module)}/defaults.mjs'\n`
    acc.mockObjects += `  ${getModuleName(module).toLowerCase()}: ${getModuleName(module).toLowerCase()},\n`
    return acc
  }, {exports: '', mockImports: '', mockObjects: ''})

const generateMacros = templates => obj => {
  const imports = generateImports(obj)
  const initialization = generateInitialization(obj)
  const enums = generateEnums(obj)
  const events = generateEvents(obj)
  const methods = generateMethods(obj, templates)
  const methodList = generateMethodList(obj)
  const onlyEventMethods = generateMethods(obj, templates, true)
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
  return macros
}

const insertAggregateMacrosOnly = (fContents = '', aggregateMacros = {}) => {
  fContents = fContents.replace(/[ \t]*\/\* \$\{EXPORTS\} \*\/[ \t]*\n/, aggregateMacros.exports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_IMPORTS\} \*\/[ \t]*\n/, aggregateMacros.mockImports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_OBJECTS\} \*\/[ \t]*\n/, aggregateMacros.mockObjects)
  return fContents
}

const insertMacros = (fContents = '', macros = {}, module = {}, version = {}) => {
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHODS\} \*\/[ \t]*\n/, macros.methods)
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHOD_LIST\} \*\/[ \t]*\n/, macros.methodList)
  fContents = fContents.replace(/[ \t]*\/\* \$\{ENUMS\} \*\/[ \t]*\n/, macros.enums)
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENTS\} \*\/[ \t]*\n/, macros.events)
  fContents = fContents.replace(/[ \t]*\/\* \$\{IMPORTS\} \*\/[ \t]*\n/, macros.imports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{INITIALIZATION\} \*\/[ \t]*\n/, macros.initialization)
  fContents = fContents.replace(/[ \t]*\/\* \$\{DEFAULTS\} \*\/[ \t]*\n/, macros.defaults)
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENT_METHODS\} \*\/[ \t]*\n/, macros.onlyEventMethods)
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
    fContents = fContents.replace(match[0], findCorrespondingMethodExample(getMethods(module))(match))
  })

  return fContents
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

function generateDefaults(json = {}) {
  const moduleName = getModuleName(json).toLowerCase()
  const reducer = compose(
    reduce((acc, val, i, arr) => {
      const def = JSON.stringify(val.examples[0].result.value, null, '  ')
      if (isPropertyMethod(val)) {
        acc += `
    ${val.name}: function () { return MockProps.mock('${moduleName}', '${val.name}', arguments, ${def}) }`
      } else {
        acc += `
    ${val.name}: ${def}`
      }
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
    ),
  
  )
  return reducer(json)
}

const generateImports = json => {
  let imports = ''

  if (rpcMethodsOrEmptyArray(json).length) {
    imports += `import Transport from '../Transport/index.mjs'\n`
  }

  if (eventsOrEmptyArray(json).length) {
    imports += `import Events from '../Events/index.mjs'\n`
    imports += `import { registerEvents } from \'../Events/index.mjs\'\n`
  }

  if (providersOrEmptyArray(json).length) {
    imports += `import Capabilities from '../Capabilities/index.mjs'\n`
    imports += `import { registerProviderInterface } from \'../Capabilities/index.mjs\'\n`
  }

  if (props(json).length) {
    imports += `import Prop from '../Prop/index.mjs'\n`
  }

  if (temporalSets(json).length) {
    imports += `import TemporalSet from '../TemporalSet/index.mjs'\n`
  }

  if (methodsWithXMethodsInResult(json).length) {
    imports += `import Results from '../Results/index.mjs'\n`
  }

  return imports
}

const generateInitialization = json => generateEventInitialization(json) + '\n' + generateProviderInitialization(json) + '\n' + generateDeprecatedInitialization(json)


const generateEventInitialization = json => compose(
  reduce((acc, method, i, arr) => {
    if (i === 0) {
      acc = []
    }
    acc.push(makeEventName(method))
    if (i < arr.length-1) {
      return acc  
    }
    return `registerEvents('${getModuleName(json)}', Object.values(${JSON.stringify(acc)}))\n`
  }, ''),
  eventsOrEmptyArray
)(json)

const getProviderInterfaceNameFromRPC = name => name.charAt(9).toLowerCase() + name.substr(10) // Drop onRequest prefix

const generateProviderInitialization = json => compose(
  reduce((acc, capability, i, arr) => {
    const methods = providersOrEmptyArray(json)
      .filter(m => m.tags.find(t => t['x-provides'] === capability))
      .map(m => ({
        name: getProviderInterfaceNameFromRPC(m.name),
        focus: ((m.tags.find(t => t['x-allow-focus']) || { 'x-allow-focus': false })['x-allow-focus']),
        response:  ((m.tags.find(t => t['x-response']) || { 'x-response': null })['x-response']) !== null,
        parameters: !providerHasNoParameters(getPayloadFromEvent(m, json))
      }))
    return acc + `registerProviderInterface('${capability}', '${getModuleName(json)}', ${JSON.stringify(methods)})\n`
  }, ''),
  providedCapabilitiesOrEmptyArray
)(json)

const generateDeprecatedInitialization = json => compose(
  reduce((acc, method, i, arr) => {
    if (i === 0) {
      acc = ''
    }
    let alternative = method.tags.find( t => t.name === 'deprecated')['x-alternative'] || ''

    if (alternative && alternative.indexOf(' ') === -1) {
      alternative = `Use ${alternative} instead.`
    }

    return acc + `Transport.registerDeprecatedMethod('${getModuleName(json)}', '${method.name}', '${alternative}')\n`
  }, ''),
  deprecatedOrEmptyArray
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
  const providerMethods = providersOrEmptyArray(json)

  const nem = notEventMethods.map(m => m.name)
  let all = [...nem]
  if (eventMethods.length) {
    all = all.concat(['listen', 'once', 'clear'])
  }
  if (providerMethods.length) {
    all.push('provide')
  }

  return all.join(',\n  ')
}

function generateMethods(json = {}, templates = {}, onlyEvents = false) {
  const moduleName = getModuleName(json).toLowerCase()
  
  // Two arrays that represent two codegen flows
  const eventMethods = eventsOrEmptyArray(json)
  const providerMethods = providersOrEmptyArray(json)
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

      methodObj = localizeDependencies(methodObj, json)

      const info = {
        title: moduleName
      }
      const method = {
        name: methodObj.name,
        params: getMethodSignatureParams(methodObj),
        transforms: null
      }

      let template = getTemplateForMethod(methodObj, '.js', templates);
      if (isPropertyMethod(methodObj)) {
        template = templates['methods/polymorphic-property.js']
      }

      if (hasMethodAttributes(methodObj)) {
        method.transforms = {
          methods: getMethodAttributes(methodObj)
        }
      }
      
      const temporalItemName = isTemporalSetMethod(methodObj) ? methodObj.result.schema.items && methodObj.result.schema.items.title || 'Item' : ''
      const temporalAddName = isTemporalSetMethod(methodObj) ? `on${temporalItemName}Available` : ''
      const temporalRemoveName = isTemporalSetMethod(methodObj) ? `on${temporalItemName}Unvailable` : ''
      const javascript = template.replace(/\$\{method\.name\}/g, method.name)
        .replace(/\$\{method\.params\}/g, method.params)
        .replace(/\$\{method\.Name\}/g, method.name[0].toUpperCase() + method.name.substr(1))
        .replace(/\$\{info\.title\}/g, info.title)
        .replace(/\$\{method\.property\.immutable\}/g, hasTag(methodObj, 'property:immutable'))
        .replace(/\$\{method\.property\.readonly\}/g, hasTag(methodObj, 'property:immutable') || hasTag(methodObj, 'property:readonly'))
        .replace(/\$\{method\.params\.count}/g, methodObj.params ? methodObj.params.length : 0)
        .replace(/\$\{method\.temporalset\.add\}/g, temporalAddName)
        .replace(/\$\{method\.temporalset\.remove\}/g, temporalRemoveName)
        .replace(/\$\{method\.transforms}/g, JSON.stringify(method.transforms))

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

    // Code to generate for methods that ARE events
    const providerMethodReducer = reduce((_) => {
      return `  
  function provide(capability, provider) {
    return Capabilities.provide(capability, provider)
  }
  `
    }, '', providerMethods)
  
  if (onlyEvents) {
    return eventMethodReducer.concat(providerMethodReducer)
  }
  return nonEventMethodReducer.concat(eventMethodReducer.concat(providerMethodReducer))
}

export {
  generateMacros,
  insertMacros,
  generateAggregateMacros,
  insertAggregateMacrosOnly,
  generateEvents,
  generateDefaults,
  generateEnums,
  generateMethods,
  generateImports,
  generateInitialization
}