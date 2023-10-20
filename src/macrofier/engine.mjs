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
const { chain, filter, option, map, reduce } = pointfree
import logic from 'crocks/logic/index.js'
const { and, not } = logic
import isString from 'crocks/core/isString.js'
import predicates from 'crocks/predicates/index.js'
const { isObject, isArray, propEq, pathSatisfies, propSatisfies } = predicates

import { isRPCOnlyMethod, isProviderInterfaceMethod, getProviderInterface, getPayloadFromEvent, providerHasNoParameters, isTemporalSetMethod, hasMethodAttributes, getMethodAttributes, isEventMethodWithContext, getSemanticVersion, getSetterFor, getProvidedCapabilities, isPolymorphicPullMethod, hasPublicAPIs, createPolymorphicMethods, isExcludedMethod, isCallsMetricsMethod } from '../shared/modules.mjs'
import isEmpty from 'crocks/core/isEmpty.js'
import { getPath as getJsonPath, getLinkedSchemaPaths, getSchemaConstraints, isSchema, localizeDependencies, isDefinitionReferencedBySchema, mergeAnyOf, mergeOneOf } from '../shared/json-schema.mjs'

// util for visually debugging crocks ADTs
const _inspector = obj => {
  if (obj.inspect) {
    console.log(obj.inspect())
  } else {
    console.log(obj)
  }
}

// getSchemaType(schema, module, options = { destination: 'file.txt', title: true })
// getSchemaShape(schema, module, options = { name: 'Foo', destination: 'file.txt' })
// getJsonType(schema, module, options = { name: 'Foo', prefix: '', descriptions: false, level: 0 })
// getSchemaInstantiation(schema, module, options = {type: 'params' | 'result' | 'callback.params'| 'callback.result' | 'callback.response'})

let types = {
  getSchemaShape: () => null,
  getSchemaType: () => null
}

let config = {
  copySchemasIntoModules: false,
  extractSubSchemas: false,
  unwrapResultObjects: false,
  excludeDeclarations: false
}

const state = {
  destination: undefined,
  typeTemplateDir: 'types',
  section: undefined
}

const capitalize = str => str[0].toUpperCase() + str.substr(1)

const indent = (str, padding) => {
  let first = true
  return str.split('\n').map(line => {
    if (first) {
      first = false
      return line
    }
    else {
      return padding + line
    }
  }).join('\n')
}

const setTyper = (t) => {
  types = t
}

const setConfig = (c) => {
  config = c
}

const getTemplate = (name, templates) => {
  return templates[Object.keys(templates).find(k => k === name)] || templates[Object.keys(templates).find(k => k.startsWith(name + '.'))] || ''
}

const getTemplateTypeForMethod = (method, type, templates) => {
  const name = method.tags && method.tags.map(tag => tag.name.split(":").shift()).find(tag => Object.keys(templates).find(name => name.startsWith(`/${type}/${tag}.`))) || 'default'
  const path = `/${type}/${name}`
  return getTemplate(path, templates)
}

const getTemplateForMethod = (method, templates, templateDir) => {
  return getTemplateTypeForMethod(method, templateDir, templates)
}

const getTemplateForDeclaration = (method, templates, templateDir) => {
  return getTemplateTypeForMethod(method, templateDir, templates)
}

const getTemplateForExample = (method, templates) => {
  return getTemplateTypeForMethod(method, 'examples', templates)
}

const getTemplateForExampleResult = (method, templates) => {
  const template = getTemplateTypeForMethod(method, 'examples/results', templates)
  return template || JSON.stringify(method.examples[0].result.value, null, '\t')
}

const getLinkForSchema = (schema, json) => {
  const dirs = config.createModuleDirectories
  const copySchemasIntoModules = config.copySchemasIntoModules

  const type = types.getSchemaType(schema, json, { templateDir: state.typeTemplateDir, destination: state.destination, section: state.section })

  // local - insert a bogus link, that we'll update later based on final table-of-contents
  if (json.components.schemas[type]) {
    return `#\$\{LINK:schema:${type}\}`
  }
  else {
    const [group, schema] = Object.entries(json['x-schemas']).find(([key, value]) => json['x-schemas'][key] && json['x-schemas'][key][type]) || [null, null]
    if (group && schema) {
      if (copySchemasIntoModules) {
        return `#\$\{LINK:schema:${type}\}`
      }
      else {
        const base = dirs ? '..' : '.'
        if (dirs) {
          return `${base}/${group}/schemas/#${type}`
        }
        else {
          return `${base}/schemas/${group}.md#${type}`
        }
      }
    }
  }

  return '#'
}

const getComponentExternalSchema = (json) => {
  let refSchemas = []
  if (json.components && json.components.schemas) {
    Object.entries(json.components.schemas).forEach(([name, schema]) => {
      let refs = getLinkedSchemaPaths(schema).map(path => getPathOr(null, path, schema))
      refs.map(ref => {
        let title = ''
        if (ref.includes('x-schemas')) {
          if (ref.split('/')[2] !== json.info.title) {
            title = ref.split('/')[2]
          }
        }
        title && !refSchemas.includes(title) ? refSchemas.push(title) : null
      })
    })
  }
  return (refSchemas)
}

// Maybe methods array of objects
const getMethods = compose(
  map(filter(isObject)),
  chain(safe(isArray)),
  getPath(['methods'])
)

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

const getAlternativeMethod = compose(
  option(null),
  map(tag => tag['x-alternative']),
  chain(find(propSatisfies('x-alternative', not(isEmpty)))),
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
      process.kill(process.pid) // Using process.kill so that other worspaces all exit (and don't bury this error w/ logs)
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

const callsMetrics = compose(
  option([]),
  map(filter(not(isExcludedMethod))),
  map(filter(isCallsMetricsMethod)),
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
  map(filter(isProviderInterfaceMethod)),
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
  map(filter(isProviderInterfaceMethod)),
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
const generateAggregateMacros = (openrpc, modules, templates, library) => Object.values(modules)
  .reduce((acc, module) => {
    acc.exports += insertMacros(getTemplate('/codeblocks/export', templates) + '\n', generateMacros(module, templates))
    acc.mockImports += insertMacros(getTemplate('/codeblocks/mock-import', templates) + '\n', generateMacros(module, templates))
    acc.mockObjects += insertMacros(getTemplate('/codeblocks/mock-parameter', templates) + '\n', generateMacros(module, templates))
    return acc
  }, {
    exports: '',
    mockImports: '',
    mockObjects: '',
    version: getSemanticVersion(openrpc),
    library: library
  })

const addContentDescriptorSubSchema = (descriptor, prefix, obj) => {
  const title = getPromotionNameFromContentDescriptor(descriptor, prefix)
  promoteSchema(descriptor, 'schema', title, obj, "#/components/schemas")
}

const getPromotionNameFromContentDescriptor = (descriptor, prefix) => {
  const subtitle = descriptor.schema.title || descriptor.name.charAt(0).toUpperCase() + descriptor.name.substring(1)
  return (prefix ? prefix.charAt(0).toUpperCase() + prefix.substring(1) : '') + subtitle
}

const promoteSchema = (location, property, title, document, destinationPath) => {
  const destination = getJsonPath(destinationPath, document)
  if (destination[title]) {
    console.log('Warning: Generated schema `' + title + '` already exists...')
  }
  destination[title] = location[property]
  destination[title].title = title
  location[property] = {
    $ref: `${destinationPath}/${title}`
  }
}

// only consider sub-objects and sub enums to be sub-schemas
const isSubSchema = (schema) => schema.type === 'object' || (schema.type === 'string' && schema.enum) // || (schema.type === 'array' && schema.items)

const promoteAndNameSubSchemas = (obj) => {
  // make a copy so we don't polute our inputs
  obj = JSON.parse(JSON.stringify(obj))
  // find anonymous method param or result schemas and name/promote them
  obj.methods && obj.methods.forEach(method => {
    method.params && method.params.forEach(param => {
      if (isSubSchema(param.schema)) {
        addContentDescriptorSubSchema(param, '', obj)
      }
    })
    if (isSubSchema(method.result.schema)) {
      addContentDescriptorSubSchema(method.result, '', obj)    
    }
    else if (isEventMethod(method) && isSubSchema(getPayloadFromEvent(method))) {
      // TODO: the `1` below is brittle... should find the index of the non-ListenResponse schema
      promoteSchema(method.result.schema.anyOf, 1, getPromotionNameFromContentDescriptor(method.result, ''), obj, '#/components/schemas')
    }
  })

  // find non-primitive sub-schemas of components.schemas and name/promote them
  if (obj.components && obj.components.schemas) {
    let more = true
    while (more) {
      more = false
      Object.entries(obj.components.schemas).forEach(([key, schema]) => {
        if ((schema.type === "object") && schema.properties) {
          Object.entries(schema.properties).forEach(([name, propSchema]) => {
            if (isSubSchema(propSchema)) {
              more = true
              const descriptor = {
                name: name,
                schema: propSchema
              }
              addContentDescriptorSubSchema(descriptor, key, obj)
              schema.properties[name] = descriptor.schema
            }
          })
        }

        if (!schema.title) {
          schema.title = capitalize(key)
        }
      })
    }
  }

  return obj
}

const skip = ['NavigationIntent']
const findAll = (tag, obj, transform) => {
  if (Array.isArray(obj)) {
    obj.forEach(item => findAll(tag, item, transform))
  }
  else if (obj && (typeof obj === "object")) {
    Object.keys(obj).forEach(key => {
      if (!skip.includes(key)) {
        if (key === tag) {
          if (obj[key].find(schema => schema.$ref.endsWith('/ListenResponse'))) {

          }
          else {
            Object.assign(obj, transform(obj))
            delete obj[key]
            console.dir(obj)
            findAll(tag, obj, transform)  
          }
        }
        else {
          findAll(tag, obj[key], transform)
        }
      }
    })
  }
}

const mergeAnyOfs = (obj) => {
  // make a copy so we don't polute our inputs
  obj = JSON.parse(JSON.stringify(obj))

  findAll('anyOf', obj, anyOf => mergeAnyOf(anyOf))

return obj
}

const generateMacros = (obj, templates, languages, options = {}) => {
  // for languages that don't support nested schemas, let's promote them to first-class schemas w/ titles
  if (config.extractSubSchemas) {
    obj = promoteAndNameSubSchemas(obj)
  }
  if (options.createPolymorphicMethods) {
    let methods = []
    obj.methods && obj.methods.forEach(method => {
      let polymorphicMethods = createPolymorphicMethods(method, obj)
      if (polymorphicMethods.length > 1) {
        polymorphicMethods.forEach(polymorphicMethod => {
          methods.push(polymorphicMethod)
        })
      }
      else {
        methods.push(method)
      }
    })
    obj.methods = methods
  }

  // config.mergeAnyOfs = true
  // if (config.mergeAnyOfs) {
  //   obj = mergeAnyOfs(obj)
  // }

  // grab the options so we don't have to pass them from method to method
  Object.assign(state, options)

  const macros = {
    schemas: {},
    types: {},
    enums: {},
    declarations: {},
    methods: {},
    events: {},
    methodList: '',
    eventList: ''
  }

  Array.from(new Set(['types'].concat(config.additionalSchemaTemplates))).filter(dir => dir).forEach(dir => {
    state.typeTemplateDir = dir
    const schemasArray = generateSchemas(obj, templates, { baseUrl: '', section: 'schemas' }).filter(s => (options.copySchemasIntoModules || !s.uri))
    macros.schemas[dir] = getTemplate('/sections/schemas', templates).replace(/\$\{schema.list\}/g, schemasArray.map(s => s.body).filter(body => body).join('\n'))
    macros.types[dir] = getTemplate('/sections/types', templates).replace(/\$\{schema.list\}/g, schemasArray.filter(x => !x.enum).map(s => s.body).filter(body => body).join('\n'))
    macros.enums[dir] = getTemplate('/sections/enums', templates).replace(/\$\{schema.list\}/g, schemasArray.filter(x => x.enum).map(s => s.body).filter(body => body).join('\n'))
  })

  state.typeTemplateDir = 'types'
  const imports = generateImports(obj, templates, { destination: (options.destination ? options.destination : '') })
  const initialization = generateInitialization(obj, templates)
  const eventsEnum = generateEvents(obj, templates)

  const examples = generateExamples(obj, templates, languages)
  const allMethodsArray = generateMethods(obj, examples, templates)

  Array.from(new Set(['declarations'].concat(config.additionalDeclarationTemplates))).filter(dir => dir).forEach(dir => {
    const declarationsArray = allMethodsArray.filter(m => m.declaration[dir] && (!config.excludeDeclarations || (!options.hideExcluded || !m.excluded)))
    macros.declarations[dir] = declarationsArray.length ? getTemplate('/sections/declarations', templates).replace(/\$\{declaration\.list\}/g, declarationsArray.map(m => m.declaration[dir]).join('\n')) : ''
  })

  Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
    const methodsArray = allMethodsArray.filter(m => m.body[dir] && !m.event && (!options.hideExcluded || !m.excluded))
    macros.methods[dir] = methodsArray.length ? getTemplate('/sections/methods', templates).replace(/\$\{method.list\}/g, methodsArray.map(m => m.body[dir]).join('\n')) : ''

    const eventsArray = allMethodsArray.filter(m => m.body[dir] && m.event && (!options.hideExcluded || !m.excluded))
    macros.events[dir] = eventsArray.length ? getTemplate('/sections/events', templates).replace(/\$\{event.list\}/g, eventsArray.map(m => m.body[dir]).join('\n')) : ''

    if (dir === 'methods') {
      macros.methodList = methodsArray.filter(m => m.body).map(m => m.name)
      macros.eventList = eventsArray.map(m => makeEventName(m))
    }
  })

  const providerInterfaces = generateProviderInterfaces(obj, templates)
  const defaults = generateDefaults(obj, templates)

  const suffix = options.destination ? options.destination.split('.').pop().trim() : ''
  const module = getTemplate('/codeblocks/module', templates)
  const moduleInclude = getTemplate(suffix ? `/codeblocks/module-include.${suffix}` : '/codeblocks/module-include', templates)
  const moduleIncludePrivate = getTemplate(suffix ? `/codeblocks/module-include-private.${suffix}` : '/codeblocks/module-include-private', templates)
  const moduleInit = getTemplate(suffix ? `/codeblocks/module-init.${suffix}` : '/codeblocks/module-init', templates)

  Object.assign(macros, {
    imports,
    initialization,
    eventsEnum,
    defaults,
    examples,
    providerInterfaces,
    version: getSemanticVersion(obj),
    title: obj.info.title,
    description: obj.info.description,
    module: module,
    moduleInclude: moduleInclude,
    moduleIncludePrivate: moduleIncludePrivate,
    moduleInit: moduleInit,
    public: hasPublicAPIs(obj)
  })

  return macros
}

const clearMacros = (fContents = '') => {
  fContents = fContents.replace(/\$\{module\.includes\}/g, "")
  fContents = fContents.replace(/\$\{module\.includes\.private\}/g, "")
  fContents = fContents.replace(/\$\{module\.init\}/g, "")

  return fContents
}

const insertAggregateMacros = (fContents = '', aggregateMacros = {}) => {
  fContents = fContents.replace(/[ \t]*\/\* \$\{EXPORTS\} \*\/[ \t]*\n/, aggregateMacros.exports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_IMPORTS\} \*\/[ \t]*\n/, aggregateMacros.mockImports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_OBJECTS\} \*\/[ \t]*\n/, aggregateMacros.mockObjects)
  fContents = fContents.replace(/\$\{readable\}/g, aggregateMacros.version.readable)
  fContents = fContents.replace(/\$\{package.name\}/g, aggregateMacros.library)

  return fContents
}

const insertMacros = (fContents = '', macros = {}) => {
  if (macros.append && macros.module) {
    fContents += '\n' + macros.module
  }

  const quote = config.operators ? config.operators.stringQuotation : '"'
  const or = config.operators ? config.operators.or : ' | '

  fContents = fContents.replace(/\$\{if\.types\}(.*?)\$\{end\.if\.types\}/gms, macros.types.types.trim() ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.schemas\}(.*?)\$\{end\.if\.schemas\}/gms, macros.schemas.types.trim() ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.enums\}(.*?)\$\{end\.if\.enums\}/gms, macros.enums.types.trim() ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.declarations\}(.*?)\$\{end\.if\.declarations\}/gms, (macros.declarations.declarations.trim() || macros.enums.types.trim()) || macros.types.types.trim()? '$1' : '')

  fContents = fContents.replace(/\$\{if\.methods\}(.*?)\$\{end\.if\.methods\}/gms, (macros.methods.methods.trim() || macros.events.methods.trim()) ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.implementations\}(.*?)\$\{end\.if\.implementations\}/gms, (macros.methods.methods.trim() || macros.events.methods.trim() || macros.schemas.types.trim()) ? '$1' : '')

  fContents = fContents.replace(/\$\{module\.list\}/g, macros.module)
  fContents = fContents.replace(/\$\{module\.includes\}/g, macros.moduleInclude)
  fContents = fContents.replace(/\$\{module\.includes\.private\}/g, macros.moduleIncludePrivate)
  fContents = fContents.replace(/\$\{module\.init\}/g, macros.moduleInit)

  fContents = fContents.replace(/\$\{if\.modules\}(.*?)\$\{end\.if\.modules\}/gms, (macros.methods.methods.trim() || macros.events.methods.trim()) ? '$1' : '')

  // Output the originally supported non-configurable declarations macros
  fContents = fContents.replace(/[ \t]*\/\* \$\{DECLARATIONS\} \*\/[ \t]*\n/, macros.declarations.declarations)
  // Output all declarations with all dynamically configured templates
  Array.from(new Set(['declarations'].concat(config.additionalDeclarationTemplates))).filter(dir => dir).forEach(dir => {
    ['DECLARATIONS'].forEach(type => {
      const regex = new RegExp('[ \\t]*\\/\\* \\$\\{' + type + '\\:' + dir + '\\} \\*\\/[ \\t]*\\n', 'g')
      fContents = fContents.replace(regex, macros[type.toLowerCase()][dir])
    })
  })

  // Output the originally supported non-configurable methods & events macros
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHODS\} \*\/[ \t]*\n/, macros.methods.methods)
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHOD_LIST\} \*\/[ \t]*\n/, macros.methodList.join(',\n'))
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENTS\} \*\/[ \t]*\n/, macros.events.methods)
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENT_LIST\} \*\/[ \t]*\n/, macros.eventList.join(','))
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENTS_ENUM\} \*\/[ \t]*\n/, macros.eventsEnum)

  // Output all methods & events with all dynamically configured templates
  Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
    ['METHODS', 'EVENTS'].forEach(type => {
      const regex = new RegExp('[ \\t]*\\/\\* \\$\\{' + type + '\\:' + dir + '\\} \\*\\/[ \\t]*\\n', 'g')
      fContents = fContents.replace(regex, macros[type.toLowerCase()][dir])
    })
  })

  // Output the originally supported non-configurable schema macros
  fContents = fContents.replace(/[ \t]*\/\* \$\{SCHEMAS\} \*\/[ \t]*\n/, macros.schemas.types)
  fContents = fContents.replace(/[ \t]*\/\* \$\{TYPES\} \*\/[ \t]*\n/, macros.types.types)
  fContents = fContents.replace(/[ \t]*\/\* \$\{ENUMS\} \*\/[ \t]*\n/, macros.enums.types)

  // Output all schemas with all dynamically configured templates
  Array.from(new Set(['types'].concat(config.additionalSchemaTemplates))).filter(dir => dir).forEach(dir => {
    ['SCHEMAS', 'TYPES', 'ENUMS'].forEach(type => {
      const regex = new RegExp('[ \\t]*\\/\\* \\$\\{' + type + '\\:' + dir + '\\} \\*\\/[ \\t]*\\n', 'g')
      fContents = fContents.replace(regex, macros[type.toLowerCase()][dir])
    })
  })

  fContents = fContents.replace(/[ \t]*\/\* \$\{PROVIDERS\} \*\/[ \t]*\n/, macros.providerInterfaces)
  fContents = fContents.replace(/[ \t]*\/\* \$\{IMPORTS\} \*\/[ \t]*\n/, macros.imports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{INITIALIZATION\} \*\/[ \t]*\n/, macros.initialization)
  fContents = fContents.replace(/[ \t]*\/\* \$\{DEFAULTS\} \*\/[ \t]*\n/, macros.defaults)
  fContents = fContents.replace(/\$\{events.array\}/g, JSON.stringify(macros.eventList))
  fContents = fContents.replace(/\$\{events\}/g, macros.eventList.map(e => `${quote}${e}${quote}`).join(or))
  fContents = fContents.replace(/\$\{major\}/g, macros.version.major)
  fContents = fContents.replace(/\$\{minor\}/g, macros.version.minor)
  fContents = fContents.replace(/\$\{patch\}/g, macros.version.patch)
  fContents = fContents.replace(/\$\{info\.title\}/g, macros.title)
  fContents = fContents.replace(/\$\{info\.title\.lowercase\}/g, macros.title.toLowerCase())
  fContents = fContents.replace(/\$\{info\.Title\}/g, capitalize(macros.title))
  fContents = fContents.replace(/\$\{info\.TITLE\}/g, macros.title.toUpperCase())
  fContents = fContents.replace(/\$\{info\.description\}/g, macros.description)
  fContents = fContents.replace(/\$\{info\.version\}/g, macros.version.readable)

  if (macros.public) {
    fContents = fContents.replace(/\$\{if\.public\}(.*?)\$\{end\.if\.public\}/gms, '$1')
  }
  else {
    fContents = fContents.replace(/\$\{if\.public\}.*?\$\{end\.if\.public\}/gms, '')
  }

  if (macros.eventList.length) {
    fContents = fContents.replace(/\$\{if\.events\}(.*?)\$\{end\.if\.events\}/gms, '$1')
  }
  else {
    fContents = fContents.replace(/\$\{if\.events\}.*?\$\{end\.if\.events\}/gms, '')
  }

  const examples = [...fContents.matchAll(/0 \/\* \$\{EXAMPLE\:(.*?)\} \*\//g)]

  examples.forEach((match) => {
    fContents = fContents.replace(match[0], JSON.stringify(macros.examples[match[1]][0].value))
  })

  fContents = insertTableofContents(fContents)

  return fContents
}

function insertTableofContents(content) {
  let toc = ''
  const count = {}
  const slugger = title => title.toLowerCase().replace(/ /g, '-').replace(/-+/g, '-').replace(/[^a-zA-Z-]/g, '')

  content.split('\n').filter(line => line.match(/^\#/)).map(line => {
    const match = line.match(/^(\#+) (.*)/)
    if (match) {
      const level = match[1].length
      if (level > 1 && level < 4) {
        const title = match[2]
        const slug = slugger(title)
        if (count.hasOwnProperty(slug)) {
          count[slug] += 1
        }
        else {
          count[slug] = 0
        }
        const link = '#' + slug + (count[slug] ? `-${count[slug]}` : '')
        toc += ' ' + '  '.repeat(level - 1) + `- [${title}](${link})\n`
      }
    }
  }).join('\n')

  content = content.replace(/\$\{toc\}/g, toc)

  const matches = [...content.matchAll(/\$\{LINK\:([a-zA-Z]+)\:([a-zA-Z]+)\}/g)]
  matches.forEach(match => {
    const candidates = toc.split('\n').filter(line => line.indexOf(`](#${slugger(match[2])}`) >= 0)
    const index = candidates.findIndex(line => line.indexOf(`- [${match[2]}](`) >= 0)

    let extra = ''

    // add '-1' to schemas when there's more than once match
    if (index > 0 && match[1] === 'schema') {
      extra = '-1'
    }
    content = content.replace(match[0], `${slugger(match[2])}${extra}`)
  })

  // replace empty links with normal text
  content = content.replace(/\[(.*?)\]\(\#\)/g, '$1')

  return content
}

const convertEnumTemplate = (schema, templateName, templates) => {
  let enumSchema = isArraySchema(schema) ? schema.items : schema
  const template = getTemplate(templateName, templates).split('\n')
  for (var i = 0; i < template.length; i++) {
    if (template[i].indexOf('${key}') >= 0) {
      template[i] = enumSchema.enum.map(value => {
        const safeName = value.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()
        return template[i].replace(/\$\{key\}/g, safeName)
          .replace(/\$\{value\}/g, value)
      }).join('\n')
      if (!templateName.includes(".cpp")) {
        template[i] = template[i].replace(/,*$/, '');
      }
    }
  }
  return template.join('\n')
    .replace(/\$\{title\}/g, capitalize(schema.title))
    .replace(/\$\{description\}/g, schema.description ? ('- ' + schema.description) : '')
    .replace(/\$\{name\}/g, schema.title)
    .replace(/\$\{NAME\}/g, schema.title.toUpperCase())
}

const enumFinder = compose(
  filter(x => isEnum(x)),
  map(([_, val]) => val),
  filter(([_key, val]) => isObject(val))
)

const generateEventEnums = (json, templates, options = { destination: '' }) => {
  const suffix = options.destination.split('.').pop()
  return compose(
    option(''),
    map(val => {
      let template = getTemplate(`/sections/enum.${suffix}`, templates)
      return template ? template.replace(/\$\{schema.list\}/g, val) : val
    }),
    map(reduce((acc, val) => acc.concat(val).concat('\n'), '')),
    map(map((schema) => convertEnumTemplate(schema, suffix ? `/types/enum.${suffix}` : '/types/enum', templates))),
    map(enumFinder),
    getSchemas
  )(json)
}

const generateEvents = (json, templates) => {
  const eventNames = eventsOrEmptyArray(json).map(makeEventName)

  const obj = eventNames.reduce((acc, val, i, arr) => {
    if (!acc) {
      acc = {
        components: {
          schemas: {
            events: {
              title: "events",
              type: "string",
              enum: []
            }
          }
        }
      }
    }

    acc.components.schemas.events.enum.push(val)
    return acc
  }, null)

  return generateEventEnums(obj, templates)
}

function generateDefaults(json = {}, templates) {
  const reducer = compose(
    reduce((acc, val, i, arr) => {
      if (isPropertyMethod(val)) {
        acc += insertMethodMacros(getTemplate('/defaults/property', templates), val, json, templates)
      } else if (val.tags.find(t => t.name === "setter")) {
        acc += insertMethodMacros(getTemplate('/defaults/setter', templates), val, json, templates)
      } else {
        acc += insertMethodMacros(getTemplate('/defaults/default', templates), val, json, templates)
      }
      if (i < arr.length - 1) {
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

function sortSchemasByReference(schemas = []) {
  let indexA = 0;
  while (indexA < schemas.length) {

    let swapped = false
    for (let indexB = indexA + 1; indexB < schemas.length; ++indexB) {
      const bInA = isDefinitionReferencedBySchema('#/components/schemas/' + schemas[indexB][0], schemas[indexA][1])
      if ((isEnum(schemas[indexB][1]) && !isEnum(schemas[indexA][1])) || (bInA === true))  {
        [schemas[indexA], schemas[indexB]] = [schemas[indexB], schemas[indexA]]
        swapped = true
        break
      }
    }
    indexA = swapped ? indexA : ++indexA
  }
  return schemas
}

const isArraySchema = x => x.type && x.type === 'array' && x.items

const isEnum = x => {
   let schema = isArraySchema(x) ? x.items : x
   return schema.type && schema.type === 'string' && Array.isArray(schema.enum) && x.title
}

function generateSchemas(json, templates, options) {
  let results = []

  const schemas = JSON.parse(JSON.stringify(json.definitions || (json.components && json.components.schemas) || {}))

  const generate = (name, schema, uri, { prefix = '' } = {}) => {
    // these are internal schemas used by the firebolt-openrpc tooling, and not meant to be used in code/doc generation
    if (['ListenResponse', 'ProviderRequest', 'ProviderResponse', 'FederatedResponse', 'FederatedRequest'].includes(name)) {
      return
    }
    let content = getTemplate('/schemas/default', templates)

    if (!schema.examples || schema.examples.length === 0) {
      content = content.replace(/\$\{if\.examples\}.*?\{end\.if\.examples\}/gms, '')
    }
    else {
      content = content.replace(/\$\{if\.examples\}(.*?)\{end\.if\.examples\}/gms, '$1')
    }

    if (!schema.description) {
      content = content.replace(/\$\{if\.description\}.*?\{end\.if\.description\}/gms, '')
    }
    else {
      content = content.replace(/\$\{if\.description\}(.*?)\{end\.if\.description\}/gms, '$1')
    }
    const schemaShape = types.getSchemaShape(schema, json, { templateDir: state.typeTemplateDir, destination: state.destination, section: options.section })

    content = content
      .replace(/\$\{schema.title\}/, (schema.title || name))
      .replace(/\$\{schema.description\}/, schema.description || '')
      .replace(/\$\{schema.shape\}/, schemaShape)

    if (schema.examples) {
      content = content.replace(/\$\{schema.example\}/, schema.examples.map(ex => JSON.stringify(ex, null, '  ')).join('\n\n'))
    }

    let seeAlso = getRelatedSchemaLinks(schema, json, templates, options)
    if (seeAlso) {
      content = content.replace(/\$\{schema.seeAlso\}/, '\n\n' + seeAlso)
    }
    else {
      content = content.replace(/.*\$\{schema.seeAlso\}/, '')
    }
    content = content.trim().length ? content : content.trim()

    const isEnum = x => x.type === 'string' && Array.isArray(x.enum) && x.title

    const result = uri ? {
      uri: uri,
      name: schema.title || name,
      body: content,
      enum: isEnum(schema)
    } : {
      name: schema.title || name,
      body: content,
      enum: isEnum(schema)
    }

    results.push(result)
  }

  let list = []

  // schemas may be 1 or 2 levels deeps
  Object.entries(schemas).forEach(([name, schema]) => {
    if (isSchema(schema)) {
      list.push([name, schema])
    }
  })

  list = sortSchemasByReference(list)
  list.forEach(item => generate(...item))

  return results
}

function getRelatedSchemaLinks(schema = {}, json = {}, templates = {}, options = {}) {
  const seen = {}
  // Generate list of links to other Firebolt docs
  //  - get all $ref nodes that point to external files
  //  - dedupe them
  //  - convert them to the $ref value (which are paths to other schema files), instead of the path to the ref node itself
  //  - convert those into markdown links of the form [Schema](Schema#/link/to/element)
  let links = getLinkedSchemaPaths(schema)
    .map(path => getPathOr(null, path, schema))
    .filter(path => seen.hasOwnProperty(path) ? false : (seen[path] = true))
    .map(path => path.substring(2).split('/'))
    .map(path => getPathOr(null, path, json))
    .filter(schema => schema.title)
    .map(schema => '[' + types.getSchemaType(schema, json, { templateDir: state.typeTemplateDir, destination: state.destination, section: state.section }) + '](' + getLinkForSchema(schema, json, { name: schema.title }) + ')') // need full module here, not just the schema
    .filter(link => link)
    .join('\n')

  return links
}

const generateImports = (json, templates, options = { destination: '' }) => {
  let imports = ''

  if (rpcMethodsOrEmptyArray(json).length) {
    imports += getTemplate('/imports/rpc', templates)
  }

  if (eventsOrEmptyArray(json).length) {
    imports += getTemplate('/imports/event', templates)
  }

  if (eventsOrEmptyArray(json).find(m => m.params.length > 1)) {
    imports += getTemplate('/imports/context-event', templates)
  }

  if (providersOrEmptyArray(json).length) {
    imports += getTemplate('/imports/provider', templates)
  }

  if (props(json).length) {
    imports += getTemplate('/imports/property', templates)
  }

  if (temporalSets(json).length) {
    imports += getTemplate('/imports/temporal-set', templates)
  }

  if (methodsWithXMethodsInResult(json).length) {
    imports += getTemplate('/imports/x-method', templates)
  }

  const suffix = options.destination.split('.').pop()
  if (callsMetrics(json).length) {
    imports += getTemplate(suffix ? `/imports/calls-metrics.${suffix}` : '/imports/calls-metrics', templates)
  }

  const destinationArray = options.destination.split('/').pop().split(/[_.]+/)
  let template = ''
  destinationArray.filter(value => value).every((suffix) => {
    template = getTemplate(`/imports/default.${suffix}`, templates)
    return template ? false: true
  })
  if (!template) {
      template = getTemplate('/imports/default', templates)
  }

  if (json['x-schemas'] && Object.keys(json['x-schemas']).length > 0 && !json.info['x-uri-titles']) {
    imports += Object.keys(json['x-schemas']).map(shared => template.replace(/\$\{info.title.lowercase\}/g, shared.toLowerCase())).join('')
  }

  let componentExternalSchema = getComponentExternalSchema(json)
  if (componentExternalSchema.length && json.info['x-uri-titles']) {
    imports += componentExternalSchema.map(shared => template.replace(/\$\{info.title.lowercase\}/g, shared.toLowerCase())).join('')
  }
  return imports
}

const generateInitialization = (json, templates) => generateEventInitialization(json, templates) + '\n' + generateProviderInitialization(json, templates) + '\n' + generateDeprecatedInitialization(json, templates)


const generateEventInitialization = (json, templates) => {
  const events = eventsOrEmptyArray(json)

  if (events.length > 0) {
    return getTemplate('/initializations/event', templates)
  }
  else {
    return ''
  }
}

const getProviderInterfaceNameFromRPC = name => name.charAt(9).toLowerCase() + name.substr(10) // Drop onRequest prefix

// TODO: this passes a JSON object to the template... might be hard to get working in non JavaScript languages.
const generateProviderInitialization = (json, templates) => compose(
  reduce((acc, capability, i, arr) => {
    const methods = providersOrEmptyArray(json)
      .filter(m => m.tags.find(t => t['x-provides'] === capability))
      .map(m => ({
        name: getProviderInterfaceNameFromRPC(m.name),
        focus: ((m.tags.find(t => t['x-allow-focus']) || { 'x-allow-focus': false })['x-allow-focus']),
        response: ((m.tags.find(t => t['x-response']) || { 'x-response': null })['x-response']) !== null,
        parameters: !providerHasNoParameters(localizeDependencies(getPayloadFromEvent(m), json))
      }))
    return acc + getTemplate('/initializations/provider', templates)
      .replace(/\$\{capability\}/g, capability)
      .replace(/\$\{interface\}/g, JSON.stringify(methods))
  }, ''),
  providedCapabilitiesOrEmptyArray
)(json)

const generateDeprecatedInitialization = (json, templates) => {
  return compose(
    reduce((acc, method, i, arr) => {
      if (i === 0) {
        acc = ''
      }
      let alternative = method.tags.find(t => t.name === 'deprecated')['x-alternative'] || ''

      if (alternative && alternative.indexOf(' ') === -1) {
        alternative = `Use ${alternative} instead.`
      }

      return acc + insertMethodMacros(getTemplate('/initializations/deprecated', templates), method, json, templates)
    }, ''),
    deprecatedOrEmptyArray
  )(json)
}

function generateExamples(json = {}, mainTemplates = {}, languages = {}) {
  const examples = {}

  json && json.methods && json.methods.forEach(method => {
    examples[method.name] = method.examples.map(example => ({
      json: example,
      value: example.result.value,
      languages: Object.fromEntries(Object.entries(languages).map(([lang, templates]) => ([lang, {
        langcode: templates['__config'].langcode,
        code: getTemplateForExample(method, templates)
          .replace(/\$\{rpc\.example\.params\}/g, JSON.stringify(Object.fromEntries(example.params.map(param => [param.name, param.value])))),
        result: getTemplateForExampleResult(method, templates)
          .replace(/\$\{example\.result\}/g, JSON.stringify(example.result.value, null, '\t'))
          .replace(/\$\{example\.result\.item\}/g, Array.isArray(example.result.value) ? JSON.stringify(example.result.value[0], null, '\t') : ''),
        template: lang === 'JSON-RPC' ? getTemplate('/examples/jsonrpc', mainTemplates) : getTemplateForExample(method, mainTemplates) // getTemplate('/examples/default', mainTemplates)
      }])))
    }))

    // delete non RPC examples from rpc-only methods
    if (isRPCOnlyMethod(method)) {
      examples[method.name] = examples[method.name].map(example => ({
        json: example.json,
        value: example.value,
        languages: Object.fromEntries(Object.entries(example.languages).filter(([k, v]) => k === 'JSON-RPC'))
      }))
    }

    // clean up JSON-RPC indentation, because it's easy and we can.
    examples[method.name].map(example => {
      if (example.languages['JSON-RPC']) {
        try {
          example.languages['JSON-RPC'].code = JSON.stringify(JSON.parse(example.languages['JSON-RPC'].code), null, '\t')
          example.languages['JSON-RPC'].result = JSON.stringify(JSON.parse(example.languages['JSON-RPC'].result), null, '\t')
        }
        catch (error) { }
      }
    })
  })

  return examples
}

function generateMethodResult(type, templates) {
  const result = {
    name: type,
    body: {},
    declaration: {},
  }

  Array.from(new Set(['declarations'].concat(config.additionalDeclarationTemplates))).filter(dir => dir).forEach(dir => {
     const template = getTemplate(('/' + dir + '/' + type), templates)
     if (template) {
       result.declaration[dir] = template
     }
  })

  Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
     const template = getTemplate(('/' + dir + '/' + type), templates)
     if (template) {
       result.body[dir] = template
     }
  })
  return result
}

function generateMethods(json = {}, examples = {}, templates = {}) {
  const methods = compose(
    option([]),
    getMethods
  )(json)

  // Code to generate methods
  const results = reduce((acc, methodObj, i, arr) => {
    const result = {
      name: methodObj.name,
      body: {},
      declaration: {},
      excluded: methodObj.tags.find(t => t.name === 'exclude-from-sdk'),
      event: isEventMethod(methodObj)
    }

    // Generate declarations for both dynamic and static configured templates
    Array.from(new Set(['declarations'].concat(config.additionalDeclarationTemplates))).filter(dir => dir).forEach(dir => {
      const template = getTemplateForDeclaration(methodObj, templates, dir)
      if (template && template.length) {
        let javascript = insertMethodMacros(template, methodObj, json, templates, examples)
        result.declaration[dir] = javascript
      }
    })

    // Generate implementation of methods/events for both dynamic and static configured templates
    Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
      const template = getTemplateForMethod(methodObj, templates, dir)
      if (template && template.length) {
        let javascript = insertMethodMacros(template, methodObj, json, templates, examples)
        result.body[dir] = javascript
      }
    })

    acc.push(result)

    return acc
  }, [], methods)

  // TODO: might be useful to pass in local macro for an array with all capability & provider interface names
  if (json.methods && json.methods.find(isProviderInterfaceMethod)) {
      results.push(generateMethodResult('provide', templates))
  }

  // TODO: might be useful to pass in local macro for an array with all event names
  if (json.methods && json.methods.find(isPublicEventMethod)) {
    ['listen', 'once', 'clear'].forEach(type => {
      results.push(generateMethodResult(type, templates))
    })
  }

  results.sort((a, b) => a.name.localeCompare(b.name))

  return results
}

// TODO: this is called too many places... let's reduce that to just generateMethods
function insertMethodMacros(template, methodObj, json, templates, examples = {}) {
  const moduleName = getModuleName(json)

  const info = {
    title: moduleName
  }
  const method = {
    name: methodObj.name,
    params: methodObj.params.map(p => p.name).join(', '),
    transforms: null,
    alternative: null,
    deprecated: isDeprecatedMethod(methodObj),
    context: []
  }

  if (isEventMethod(methodObj) && methodObj.params.length > 1) {
    method.context = methodObj.params.filter(p => p.name !== 'listen').map(p => p.name)
  }

  if (getAlternativeMethod(methodObj)) {
    method.alternative = getAlternativeMethod(methodObj)
  }

  const flattenedMethod = localizeDependencies(methodObj, json)

  if (hasMethodAttributes(flattenedMethod)) {
    method.transforms = {
      methods: getMethodAttributes(flattenedMethod)
    }
  }

  const paramDelimiter = config.operators ? config.operators.paramDelimiter : ', '

  const temporalItemName = isTemporalSetMethod(methodObj) ? methodObj.result.schema.items && methodObj.result.schema.items.title || 'Item' : ''
  const temporalAddName = isTemporalSetMethod(methodObj) ? `on${temporalItemName}Available` : ''
  const temporalRemoveName = isTemporalSetMethod(methodObj) ? `on${temporalItemName}Unvailable` : ''
  const params = methodObj.params && methodObj.params.length ? getTemplate('/sections/parameters', templates) + methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, methodObj, json)).join(paramDelimiter) : ''
  const paramsRows = methodObj.params && methodObj.params.length ? methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, methodObj, json)).join('') : ''
  const paramsAnnotations = methodObj.params && methodObj.params.length ? methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/annotations', templates), p, methodObj, json)).join('') : ''
  const paramsJson = methodObj.params && methodObj.params.length ? methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/json', templates), p, methodObj, json)).join('') : ''

  const deprecated = methodObj.tags && methodObj.tags.find(t => t.name === 'deprecated')
  const deprecation = deprecated ? deprecated['x-since'] ? `since version ${deprecated['x-since']}` : '' : ''

  const capabilities = getTemplate('/sections/capabilities', templates) + insertCapabilityMacros(getTemplate('/capabilities/default', templates), methodObj.tags.find(t => t.name === "capabilities"), methodObj, json)

  const result = JSON.parse(JSON.stringify(methodObj.result))
  const event = isEventMethod(methodObj) ? JSON.parse(JSON.stringify(methodObj)) : ''

  if (event) {
    result.schema = JSON.parse(JSON.stringify(getPayloadFromEvent(methodObj)))
    event.result.schema = getPayloadFromEvent(event)
    event.params = event.params.filter(p => p.name !== 'listen')
  }

  const eventParams = event.params && event.params.length ? getTemplate('/sections/parameters', templates) + event.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, event, json)).join('') : ''
  const eventParamsRows = event.params && event.params.length ? event.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, event, json)).join('') : ''

  let itemName = ''
  let itemType = ''

  // grab some related methdos in case they are output together in a single template file
  const puller = json.methods.find(method => method.tags.find(tag => tag['x-pulls-for'] === methodObj.name))
  const pullsFor = methodObj.tags.find(t => t['x-pulls-for']) && json.methods.find(method => method.name === methodObj.tags.find(t => t['x-pulls-for'])['x-pulls-for'])
  const pullerTemplate = (puller ? insertMethodMacros(getTemplate('/codeblocks/puller', templates), puller, json, templates, examples) : '')
  const setter = getSetterFor(methodObj.name, json)
  const setterTemplate = (setter ? insertMethodMacros(getTemplate('/codeblocks/setter', templates), setter, json, templates, examples) : '')
  const subscriber = json.methods.find(method => method.tags.find(tag => tag['x-alternative'] === methodObj.name))
  const subscriberTemplate = (subscriber ? insertMethodMacros(getTemplate('/codeblocks/subscriber', templates), subscriber, json, templates, examples) : '')
  const setterFor = methodObj.tags.find(t => t.name === 'setter') && methodObj.tags.find(t => t.name === 'setter')['x-setter-for'] || ''
  const pullsResult = (puller || pullsFor) ? localizeDependencies(pullsFor || methodObj, json).params[1].schema : null
  const pullsParams = (puller || pullsFor) ? localizeDependencies(getPayloadFromEvent(puller || methodObj), json, null, { mergeAllOfs: true }).properties.parameters : null

  const pullsResultType = pullsResult && types.getSchemaShape(pullsResult, json, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section })
  const pullsForType = pullsResult && types.getSchemaType(pullsResult, json, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section })
  const pullsParamsType = pullsParams ? types.getSchemaShape(pullsParams, json, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section }) : ''
  const serializedParams = flattenedMethod.params.map(param => types.getSchemaShape(param.schema, json, { templateDir: 'parameter-serialization', property: param.name, destination: state.destination, section: state.section, level: 1, skipTitleOnce: true })).join('\n')
  const resultInst = types.getSchemaShape(flattenedMethod.result.schema, json, { templateDir: 'result-instantiation', property: flattenedMethod.result.name, destination: state.destination, section: state.section, level: 1, skipTitleOnce: true }) // w/out level: 1, getSchemaShape skips anonymous types, like primitives
  const serializedEventParams = event ? flattenedMethod.params.filter(p => p.name !== 'listen').map(param => types.getSchemaShape(param.schema, json, {templateDir: 'parameter-serialization', property: param.name, destination: state.destination, section: state.section, level: 1, skipTitleOnce: true })).join('\n') : ''
  // this was wrong... check when we merge if it was fixed
  const callbackSerializedParams = event ? types.getSchemaShape(event.result.schema, json, { templateDir: 'parameter-serialization', property: result.name, destination: state.destination, section: state.section, level: 1, skipTitleOnce: true }) : ''
  const callbackResultInst = event ? types.getSchemaShape(event, json, { templateDir: 'result-instantiation' }) : ''
//  const callbackResponseInst = event ? types.getSchemaInstantiation(event, json, event.name, { instantiationType: 'callback.response' }) : ''
  // hmm... how is this different from callbackSerializedParams? i guess they get merged?
  const callbackResponseInst = event ? types.getSchemaShape(event.result.schema, json, { templateDir: 'parameter-serialization', property: result.name, destination: state.destination, section: state.section, level: 1, skipTitleOnce: true }) : ''
  const resultType = result.schema ? types.getSchemaType(result.schema, json, { templateDir: state.typeTemplateDir }) : ''
  const resultJsonType = result.schema ? types.getSchemaType(result.schema, json, { templateDir: 'json-types' }) : ''
  const resultParams = generateResultParams(result.schema, json, templates, { name: result.name})

  // todo: what does prefix do in Types.mjs? need to account for it somehow
  const callbackResultJsonType = event && result.schema ? types.getSchemaType(result.schema, json, { templateDir: 'json-types' }) : ''

  const pullsForParamType = pullsParams ? types.getSchemaType(pullsParams, json, { destination: state.destination, section: state.section }) : ''
  const pullsForJsonType = pullsResult ? types.getSchemaType(pullsResult, json, { templateDir: 'json-types' }) : ''
  const pullsForParamJsonType = pullsParams ? types.getSchemaType(pullsParams, json, { templateDir: 'json-types' }) : ''
  
  const pullsEventParamName = event ? types.getSchemaInstantiation(event.result, json, event.name, { instantiationType: 'pull.param.name' }) : ''

  let seeAlso = ''
  if (isPolymorphicPullMethod(methodObj) && pullsForType) {
    seeAlso = `See also: [${pullsForType}](#${pullsForType.toLowerCase()}-1)` // this assumes the schema will be after the method...
  }
  else if (methodObj.tags.find(t => t.name === 'polymorphic-pull')) {
    const type = method.name[0].toUpperCase() + method.name.substring(1)
    seeAlso = `See also: [${type}](#${type.toLowerCase()}-1)` // this assumes the schema will be after the method...
  }

  if (isTemporalSetMethod(methodObj)) {
    itemName = result.schema.items.title || 'item'
    itemName = itemName.charAt(0).toLowerCase() + itemName.substring(1)
    itemType = types.getSchemaType(result.schema.items, json, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section })
  }

  template = insertExampleMacros(template, examples[methodObj.name] || [], methodObj, json, templates)

  template = template.replace(/\$\{method\.name\}/g, method.name)
    .replace(/\$\{method\.rpc\.name\}/g, methodObj.title || methodObj.name)
    .replace(/\$\{method\.summary\}/g, methodObj.summary)
    .replace(/\$\{method\.description\}/g, methodObj.description
      || methodObj.summary)
    // Parameter stuff
    .replace(/\$\{method\.params\}/g, params)
    .replace(/\$\{method\.params\.table\.rows\}/g, paramsRows)
    .replace(/\$\{method\.params\.annotations\}/g, paramsAnnotations)
    .replace(/\$\{method\.params\.json\}/g, paramsJson)
    .replace(/\$\{method\.params\.list\}/g, method.params)
    .replace(/\$\{method\.params\.array\}/g, JSON.stringify(methodObj.params.map(p => p.name)))
    .replace(/\$\{method\.params\.count}/g, methodObj.params ? methodObj.params.length : 0)
    .replace(/\$\{if\.params\}(.*?)\$\{end\.if\.params\}/gms, method.params.length ? '$1' : '')
    .replace(/\$\{if\.result\}(.*?)\$\{end\.if\.result\}/gms, resultType ? '$1' : '')
    .replace(/\$\{if\.result.nonvoid\}(.*?)\$\{end\.if\.result.nonvoid\}/gms, resultType && resultType !== 'void' ? '$1' : '')
    .replace(/\$\{if\.result\.properties\}(.*?)\$\{end\.if\.result\.properties\}/gms, resultParams ? '$1' : '')
    .replace(/\$\{if\.params\.empty\}(.*?)\$\{end\.if\.params\.empty\}/gms, method.params.length === 0 ? '$1' : '')
    .replace(/\$\{if\.signature\.empty\}(.*?)\$\{end\.if\.signature\.empty\}/gms, (method.params.length === 0 && resultType === '') ? '$1' : '')
    .replace(/\$\{if\.context\}(.*?)\$\{end\.if\.context\}/gms, event && event.params.length ? '$1' : '')
    .replace(/\$\{method\.params\.serialization\}/g, serializedParams)
    .replace(/\$\{method\.params\.serialization\.with\.indent\}/g, indent(serializedParams, '    '))
    // Typed signature stuff
    .replace(/\$\{method\.signature\.params\}/g, types.getMethodSignatureParams(methodObj, json, { destination: state.destination, section: state.section }))
    .replace(/\$\{method\.signature\.result\}/g, types.getMethodSignatureResult(methodObj, json, { destination: state.destination, section: state.section }))
    .replace(/\$\{method\.context\}/g, method.context.join(', '))
    .replace(/\$\{method\.context\.array\}/g, JSON.stringify(method.context))
    .replace(/\$\{method\.context\.count}/g, method.context ? method.context.length : 0)
    .replace(/\$\{method\.deprecation\}/g, deprecation)
    .replace(/\$\{method\.Name\}/g, method.name[0].toUpperCase() + method.name.substr(1))
    .replace(/\$\{event\.name\}/g, method.name.toLowerCase()[2] + method.name.substr(3))
    .replace(/\$\{event\.params\}/g, eventParams)
    .replace(/\$\{event\.params\.table\.rows\}/g, eventParamsRows)
    .replace(/\$\{if\.event\.params\}(.*?)\$\{end\.if\.event\.params\}/gms, event && event.params.length ? '$1' : '')
    .replace(/\$\{event\.signature\.params\}/g, event ? types.getMethodSignatureParams(event, json, { destination: state.destination, section: state.section }) : '')
    .replace(/\$\{event\.signature\.callback\.params\}/g, event ? types.getMethodSignatureParams(event, json, { destination: state.destination, section: state.section, callback: true }) : '')
    .replace(/\$\{event\.params\.serialization\}/g, serializedEventParams)
    .replace(/\$\{event\.callback\.params\.serialization\}/g, callbackSerializedParams)
    .replace(/\$\{event\.callback\.result\.instantiation\}/g, callbackResultInst)
    .replace(/\$\{event\.callback\.response\.instantiation\}/g, callbackResponseInst)
    .replace(/\$\{info\.title\.lowercase\}/g, info.title.toLowerCase())
    .replace(/\$\{info\.title\}/g, info.title)
    .replace(/\$\{info\.Title\}/g, capitalize(info.title))
    .replace(/\$\{info\.TITLE\}/g, info.title.toUpperCase())
    .replace(/\$\{method\.property\.immutable\}/g, hasTag(methodObj, 'property:immutable'))
    .replace(/\$\{method\.property\.readonly\}/g, !getSetterFor(methodObj.name, json))
    .replace(/\$\{method\.temporalset\.add\}/g, temporalAddName)
    .replace(/\$\{method\.temporalset\.remove\}/g, temporalRemoveName)
    .replace(/\$\{method\.transforms}/g, JSON.stringify(method.transforms))
    .replace(/\$\{method\.seeAlso\}/g, seeAlso)
    .replace(/\$\{method\.item\}/g, itemName)
    .replace(/\$\{method\.item\.type\}/g, itemType)
    .replace(/\$\{method\.capabilities\}/g, capabilities)
    .replace(/\$\{method\.result\.name\}/g, result.name)
    .replace(/\$\{method\.result\.summary\}/g, result.summary)
    .replace(/\$\{method\.result\.link\}/g, getLinkForSchema(result.schema, json)) //, baseUrl: options.baseUrl
    .replace(/\$\{method\.result\.type\}/g, types.getSchemaType(result.schema, json, { templateDir: state.typeTemplateDir, title: true, asPath: false, destination: state.destination, result: true })) //, baseUrl: options.baseUrl
    .replace(/\$\{method\.result\.json\}/, types.getSchemaType(result.schema, json, { templateDir: 'json-types', destination: state.destination, section: state.section, title: true, code: false, link: false, asPath: false, expandEnums: false, namespace: true }))
    // todo: what does prefix do?
    .replace(/\$\{event\.result\.type\}/g, isEventMethod(methodObj) ? types.getMethodSignatureResult(event, json, { destination: state.destination, section: state.section, callback: true }) : '')
    .replace(/\$\{event\.result\.json\.type\}/g, resultJsonType)
    .replace(/\$\{event\.result\.json\.type\}/g, callbackResultJsonType)
    .replace(/\$\{event\.pulls\.param\.name\}/g, pullsEventParamName)
    .replace(/\$\{method\.result\}/g, generateResult(result.schema, json, templates, { name: result.name }))
    .replace(/\$\{method\.result\.json\.type\}/g, resultJsonType)
    .replace(/\$\{method\.result\.instantiation\}/g, resultInst)
    .replace(/\$\{method\.result\.properties\}/g, resultParams)
    .replace(/\$\{method\.result\.instantiation\.with\.indent\}/g, indent(resultInst, '    '))
    .replace(/\$\{method\.example\.value\}/g, JSON.stringify(methodObj.examples[0].result.value))
    .replace(/\$\{method\.alternative\}/g, method.alternative)
    .replace(/\$\{method\.alternative.link\}/g, '#' + (method.alternative || "").toLowerCase())
    .replace(/\$\{method\.pulls\.for\}/g, pullsFor ? pullsFor.name : '')
    .replace(/\$\{method\.pulls\.type\}/g, pullsForType)
    .replace(/\$\{method\.pulls\.json\.type\}/g, pullsForJsonType)
    .replace(/\$\{method\.pulls\.result\}/g, pullsResultType)
    .replace(/\$\{method\.pulls\.params.type\}/g, pullsParams ? pullsParams.title : '')
    .replace(/\$\{method\.pulls\.params\}/g, pullsParamsType)
    .replace(/\$\{method\.pulls\.param\.type\}/g, pullsForParamType)
    .replace(/\$\{method\.pulls\.param\.json\.type\}/g, pullsForParamJsonType)
    .replace(/\$\{method\.setter\.for\}/g, setterFor)
    .replace(/\$\{method\.puller\}/g, pullerTemplate) // must be last!!
    .replace(/\$\{method\.setter\}/g, setterTemplate) // must be last!!
    .replace(/\$\{method\.subscriber\}/g, subscriberTemplate) // must be last!!


  if (method.deprecated) {
    template = template.replace(/\$\{if\.deprecated\}(.*?)\$\{end\.if\.deprecated\}/gms, '$1')
  }
  else {
    template = template.replace(/\$\{if\.deprecated\}(.*?)\$\{end\.if\.deprecated\}/gms, '')
  }

  // method.params[n].xxx macros
  const matches = [...template.matchAll(/\$\{method\.params\[([0-9]+)\]\.type\}/g)]
  matches.forEach(match => {
    const index = parseInt(match[1])
    template = template.replace(/\$\{method\.params\[([0-9]+)\]\.type\}/g, types.getSchemaType(methodObj.params[index].schema, json, { destination: state.destination, templateDir: state.typeTemplateDir }))
    template = template.replace(/\$\{method\.params\[([0-9]+)\]\.name\}/g, methodObj.params[index].name)
  })

  // Note that we do this twice to ensure all recursive macros are resolved
  template = insertExampleMacros(template, examples[methodObj.name] || [], methodObj, json, templates)

  return template
}

function insertExampleMacros(template, examples, method, json, templates) {

  let content = ''

  if (!examples) return template

  let originator

  if (isPolymorphicPullMethod(method)) {
    originator = json.methods.find(m => m.name === method.tags.find(t => t['x-pulls-for'])['x-pulls-for'])
  }

  let index = -1
  examples.forEach(example => {
    index++
    let code = getTemplate('/codeblocks/example', templates)
    let first = true
    let languages = ''
    Object.entries(example.languages).forEach(([name, language]) => {
      let languageContent = language.template //getTemplateForExample(method, templates)
      // wrap example in collapsible HTML if not first
      if (!first) {
        languageContent = '<details>\n' + languageContent.replace(/\$\{example\.language\}(.*?)\n/, '<summary>$${example.language}$1</summary>') + '</details>'
      }

      first = false

      const formatParams = (params, delimit, pretty = false) => params.map(p => JSON.stringify((example.json.params.find(x => x.name === p.name) || { value: null }).value, null, pretty ? '  ' : null)).join(delimit)
      let indent = ' '.repeat(json.info.title.length + method.name.length + 2)
      let params = formatParams(method.params, ', ')
      if (params.length + indent > 80) {
        params = formatParams(method.params, ',\n', true)
        params = params.split('\n')
        let first = params.shift()
        params = params.map(p => indent + p)
        params.unshift(first)
        params = params.join('\n')
      }

      languageContent = languageContent
        .replace(/\$\{example\.code\}/g, language.code)
        .replace(/\$\{example\.name\}/g, example.json.name)
        .replace(/\$\{example\.language\}/g, name)
        .replace(/\$\{example\.langcode\}/g, language.langcode)

        .replace(/\$\{method\.result\.name\}/g, method.result.name)
        .replace(/\$\{method\.name\}/g, method.name)
        .replace(/\$\{example\.params\}/g, params)
        .replace(/\$\{example\.result\}/g, language.result)
        .replace(/\$\{example\.result\.item\}/g, Array.isArray(example.json.result.value) ? JSON.stringify(example.json.result.value[0], null, '\t') : '')
        .replace(/\$\{module\}/g, json.info.title)

      const matches = [...languageContent.matchAll(/\$\{method\.params\[([0-9]+)\]\.example\.value\}/g)]
      matches.forEach(match => {
        const paramIndex = parseInt(match[1])
        let indent = 0
        while (match.index - indent >= 0 && match.input[match.index - indent] !== '\n') {
          indent++
        }
        const value = JSON.stringify(method.examples[index].params[paramIndex].value, null, '\t').split('\n').map((line, i) => i > 0 ? ' '.repeat(indent) + line : line).join('\n')
        languageContent = languageContent.replace(/\$\{method\.params\[([0-9]+)\]\.example\.value\}/g, value)
      })


      if (originator) {
        const originalExample = originator.examples.length > index ? originator.examples[index] : originator.examples[0]
        const matches = [...languageContent.matchAll(/\$\{originator\.params\[([0-9]+)\]\.example\.value\}/g)]
        matches.forEach(match => {
          const paramIndex = parseInt(match[1])
          let indent = 0
          while (match.index - indent >= 0 && match.input[match.index - indent] !== '\n') {
            indent++
          }
          const value = JSON.stringify(originalExample.params[paramIndex].value, null, '\t').split('\n').map((line, i) => i > 0 ? ' '.repeat(indent) + line : line).join('\n')
          languageContent = languageContent.replace(/\$\{originator\.params\[([0-9]+)\]\.example\.value\}/g, value)
        })
      }

      languages += languageContent
    })

    code = code
      .replace(/\$\{example\.name\}/g, example.json.name)
      .replace(/\$\{example\.title\}/g, example.json.name)
      .replace(/\$\{example\.name\}/g, example.json.name)
      .replace(/\$\{example\.languages\}/g, languages)

    content += code
  })

  return template.replace(/\$\{method\.examples\}/g, content)
}

function generateResult(result, json, templates, { name = '' } = {}) {

  const type = types.getSchemaType(result, json, { templateDir: state.typeTemplateDir, destination: state.destination, section: state.section })

  if (result.type === 'object' && result.properties) {
    let content = getTemplate('/types/object', templates).split('\n')

    for (var i = 0; i < content.length; i++) {
      if (content[i].indexOf("${property}") >= 0) {
        content[i] = Object.entries(result.properties).map(([title, property]) => insertSchemaMacros(content[i], title, property, json)).join('\n')
      }
    }

    return insertSchemaMacros(content.join('\n'), name, result, json)
  }
  else if (type === 'string' && Array.isArray(result.enum)) {
    return insertSchemaMacros(getTemplate('/types/enum', templates), name, result, json)
  }
  else if (result.$ref) {
    const link = getLinkForSchema(result, json)

    // if we get a real link use it
    if (link !== '#') {
      return `[${types.getSchemaType(result, json, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section })}](${link})`
    }
    // otherwise this was a schema with no title, and we'll just copy it here
    else {
      const schema = localizeDependencies(result, json)
      return getTemplate('/types/default', templates)
        .replace(/\$\{type\}/, types.getSchemaShape(schema, json, { templateDir: state.typeTemplateDir }))
    }
  }
  else {
    return insertSchemaMacros(getTemplate('/types/default', templates), name, result, json)
  }
}

function generateResultParams(result, json, templates, { name = '' } = {}) {
  let moduleTitle = json.info.title

  while (result.$ref) {
    if (result.$ref.includes("/x-schemas/")) {
      moduleTitle = result.$ref.split("/")[2]
    }
    result = getJsonPath(result.$ref, json)
  }

  // const results are almost certainly `"const": "null"` so there's no need to include it in the method signature
  if (result.hasOwnProperty('const')) {
    return ''
  }
  // Objects with no titles get unwrapped
  else if (config.unwrapResultObjects && result.type && !result.title && result.type === 'object' && result.properties) {
    const template = getTemplate('/parameters/result', templates)
    return Object.entries(result.properties).map( ([name, type]) => template
                                                                      .replace(/\$\{method\.param\.name\}/g, name)
                                                                      .replace(/\$\{method\.param\.type\}/g, types.getSchemaType(type, json, { moduleTitle: moduleTitle, result: true, namespace: true}))
    ).join(', ') // most languages separate params w/ a comma, so leaving this here for now  
  }
  // tuples get unwrapped
  else if (config.unwrapResultObjects && result.type && result.type === 'array' && Array.isArray(result.items)) {
    // TODO: this is hard coded to C
    const template = getTemplate('/parameters/result', templates)
    return result.items.map( (type) => template
                                        .replace(/\$\{method\.param\.name\}/g, type['x-property'])
                                        .replace(/\$\{method\.param\.type\}/g, types.getSchemaType(type, json, { moduleTitle: moduleTitle, result: true, namespace: true}))
    ).join(', ')
  }
  // everything else is just output as-is
  else {

    const template = getTemplate('/parameters/result', templates)
    const type = types.getSchemaType(result, json, { moduleTitle: moduleTitle, result: true, namespace: true})
    if (type === 'undefined') {
      console.log(`Warning: undefined type for ${name}`)
    }

    return template
      .replace(/\$\{method\.param\.name\}/g, `${name}`)
      .replace(/\$\{method\.param\.type\}/g, type)
  }
}

function insertSchemaMacros(template, title, schema, module) {
  return template.replace(/\$\{property\}/g, title)
    .replace(/\$\{type\}/g, types.getSchemaType(schema, module, { templateDir: state.typeTemplateDir, destination: state.destination, section: state.section, code: false }))
    .replace(/\$\{type.link\}/g, getLinkForSchema(schema, module))
    .replace(/\$\{description\}/g, schema.description || '')
    .replace(/\$\{name\}/g, title || '')
}

function insertParameterMacros(template, param, method, module) {

  //| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

  let constraints = getSchemaConstraints(param, module)
  let type = types.getSchemaType(param.schema, module, { templateDir: state.typeTemplateDir, destination: state.destination, section: state.section, code: false, link: false, asPath: false, expandEnums: false }) //baseUrl: options.baseUrl
  let typeLink = getLinkForSchema(param.schema, module)
  let jsonType = types.getSchemaType(param.schema, module, { templateDir: 'json-types', destination: state.destination, section: state.section, code: false, link: false, asPath: false, expandEnums: false })

  if (constraints && type) {
    constraints = '<br/>' + constraints
  }

  return template
    .replace(/\$\{method.param.name\}/g, param.name)
    .replace(/\$\{method.param.Name\}/g, param.name[0].toUpperCase() + param.name.substring(1))
    .replace(/\$\{method.param.summary\}/g, param.summary || '')
    .replace(/\$\{method.param.required\}/g, param.required || 'false')
    .replace(/\$\{method.param.type\}/g, type)
    .replace(/\$\{json.param.type\}/g, jsonType)
    .replace(/\$\{method.param.link\}/g, getLinkForSchema(param.schema, module)) //getType(param))
    .replace(/\$\{method.param.constraints\}/g, constraints) //getType(param)) 
}

function insertCapabilityMacros(template, capabilities, method, module) {
  const content = []
  const roles = ['x-uses', 'x-manages']

  roles.forEach(role => {
    if (capabilities[role] && capabilities[role].length) {
      content.push(template.replace(/\$\{role\}/g, role.split('-').pop())
        .replace(/\$\{capability\}/g, capabilities[role].join('<br/>'))) // Warning, hack!
    }
  })

  if (capabilities['x-provides']) {
    content.push(template.replace(/\$\{role\}/g, 'provides')
      .replace(/\$\{capability\}/g, capabilities['x-provides']))
  }

  return content.join()
}

function generateProviderInterfaces(json, templates) {
  const interfaces = getProvidedCapabilities(json)
  let template = getTemplate('/sections/provider-interfaces', templates)
  const providers = reduce((acc, capability) => {
    const template = insertProviderInterfaceMacros(getTemplate('/codeblocks/provider', templates), capability, json, templates)

    return acc + template
  }, '', interfaces)

  return interfaces.length ? template.replace(/\$\{providers\.list\}/g, providers) : ''
}

function insertProviderInterfaceMacros(template, capability, moduleJson = {}, templates) {
  const iface = getProviderInterface(capability, moduleJson, { destination: state.destination, section: state.section })//.map(method => { method.name = method.name.charAt(9).toLowerCase() + method.name.substr(10); return method } )

  const uglyName = capability.split(":").slice(-2).map(capitalize).reverse().join('') + "Provider"
  let name = iface.length === 1 ? iface[0].name.charAt(0).toUpperCase() + iface[0].name.substr(1) + "Provider" : uglyName

  if (moduleJson.info['x-interface-names']) {
    name = moduleJson.info['x-interface-names'][capability] || name
  }

  let interfaceShape = getTemplate('/codeblocks/interface', templates)

  interfaceShape = interfaceShape.replace(/\$\{name\}/g, name)
    .replace(/\$\{capability\}/g, capability)
    .replace(/[ \t]*\$\{methods\}[ \t]*\n/g, iface.map(method => {
      const focusable = method.tags.find(t => t['x-allow-focus'])
      const interfaceDeclaration = getTemplate('/interfaces/' + (focusable ? 'focusable' : 'default'), templates)
      return insertMethodMacros(interfaceDeclaration, method, moduleJson, { destination: state.destination, section: state.section, isInterface: true })
    }).join('') + '\n')
      
  if (iface.length === 0) {
    template = template.replace(/\$\{provider\.methods\}/gms, '')
  }
  else {
    let regex = /\$\{provider\.methods\}/gms
    let match = template.match(regex)

    let methodsBlock = ''

    // insert the standard method templates for each provider
    if (match) {
      iface.forEach(method => {
        // add a tag to pick the correct template
        method.tags.unshift({
          name: 'provider'
        })
        const parametersSchema = method.params[0].schema
        const parametersShape = types.getSchemaShape(parametersSchema, moduleJson, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section })
        let methodBlock = insertMethodMacros(getTemplateForMethod(method, templates), method, moduleJson, templates)
        methodBlock = methodBlock.replace(/\${parameters\.shape\}/g, parametersShape)
        const hasProviderParameters = parametersSchema && parametersSchema.properties && Object.keys(parametersSchema.properties).length > 0
        if (hasProviderParameters) {
          const lines = methodBlock.split('\n')
          for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].match(/\$\{provider\.param\.[a-zA-Z]+\}/)) {
              let line = lines[i]
              lines.splice(i, 1)
              line = insertProviderParameterMacros(line, method.params[0].schema, moduleJson)
              lines.splice(i++, 0, line)
            }
          }
          methodBlock = lines.join('\n')
        }
        else {
          methodBlock = methodBlock.replace(/\$\{if\.provider\.params\}.*?\$\{end\.if\.provider\.params\}/gms, '')
        }
        methodsBlock += methodBlock
      })

      match = template.match(regex)
      template = template.replace(regex, methodsBlock)
    }

    regex = /\$\{provider\.interface\.start\}.*?\$\{provider\.interface\.end\}/s

    // insert the granular method details for any ${provider.method.start} loops
    while (match = template.match(regex)) {
      let methodsBlock = ''

      let i = 1
      iface.forEach(method => {

        methodsBlock += match[0].replace(/\$\{provider\.interface\.name\}/g, method.name)
          .replace(/\$\{provider\.interface\.Name\}/g, method.name.charAt(0).toUpperCase() + method.name.substr(1))

          // first check for indented lines, and do the fancy indented replacement
          .replace(/^([ \t]+)(.*?)\$\{provider\.interface\.example\.result\}/gm, '$1$2' + indent(JSON.stringify(method.examples[0].result.value, null, '    '), '$1'))
          .replace(/^([ \t]+)(.*?)\$\{provider\.interface\.example\.parameters\}/gm, '$1$2' + indent(JSON.stringify(method.examples[0].params[0].value, null, '    '), '$1'))
          // okay now just do the basic replacement (a single regex for both was not fun)
          .replace(/\$\{provider\.interface\.example\.result\}/g, JSON.stringify(method.examples[0].result.value))
          .replace(/\$\{provider\.interface\.example\.parameters\}/g, JSON.stringify(method.examples[0].params[0].value))

          .replace(/\$\{provider\.interface\.example\.correlationId\}/g, JSON.stringify(method.examples[0].params[1].value.correlationId))

          // a set of up to three RPC "id" values for generating intersting examples with matching ids
          .replace(/\$\{provider\.interface\.i\}/g, i)
          .replace(/\$\{provider\.interface\.j\}/g, (i + iface.length))
          .replace(/\$\{provider\.interface\.k\}/g, (i + 2 * iface.length))

        i++
      })
      methodsBlock = methodsBlock.replace(/\$\{provider\.interface\.[a-zA-Z]+\}/g, '')
      template = template.replace(regex, methodsBlock)
    }
  }

  // TODO: JSON-RPC examples need to use ${provider.interface} macros, but we're replacing them globally instead of each block
  // there's examples of this in methods, i think

  template = template.replace(/\$\{provider\}/g, name)
  template = template.replace(/\$\{interface\}/g, interfaceShape)
  template = template.replace(/\$\{capability\}/g, capability)

  return template
}

function insertProviderParameterMacros(data = '', parameters, module = {}, options = {}) {

  if (!parameters || !parameters.properties) {
    return ''
  }

  let result = ''

  Object.entries(parameters.properties).forEach(([name, param]) => {
    let constraints = getSchemaConstraints(param, module)
    let type = types.getSchemaType(param, module, { destination: state.destination, templateDir: state.typeTemplateDir, section: state.section, code: true, link: true, asPath: options.asPath, baseUrl: options.baseUrl })

    if (constraints && type) {
      constraints = '<br/>' + constraints
    }

    result += data
      .replace(/\$\{provider.param.name\}/, name)
      .replace(/\$\{provider.param.summary\}/, param.description || '')
      .replace(/\$\{provider.param.required\}/, (parameters.required && parameters.required.includes(name)) || 'false')
      .replace(/\$\{provider.param.type\}/, type)
      .replace(/\$\{provider.param.constraints\}/, constraints) + '\n'
  })

  return result
}

export {
  generateMacros,
  clearMacros,
  insertMacros,
  generateAggregateMacros,
  insertAggregateMacros
}

export default {
  generateMacros,
  clearMacros,
  insertMacros,
  generateAggregateMacros,
  insertAggregateMacros,
  setTyper,
  setConfig
}
