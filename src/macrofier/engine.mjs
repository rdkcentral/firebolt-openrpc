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
import isEmpty from 'crocks/core/isEmpty.js'
const { and, not } = logic
import isString from 'crocks/core/isString.js'
import predicates from 'crocks/predicates/index.js'
const { isObject, isArray, propEq, pathSatisfies, propSatisfies } = predicates

import { isRPCOnlyMethod, isProviderInterfaceMethod, getProviderInterface, getPayloadFromEvent, isTemporalSetMethod, hasMethodAttributes, getMethodAttributes, getSemanticVersion, getSetterFor, getProvidedCapabilities, isPolymorphicPullMethod, hasPublicAPIs, isAllowFocusMethod, hasAllowFocusMethods, isExcludedMethod, isCallsMetricsMethod, getInterfaces, getUnidirectionalProviderInterfaceName } from '../shared/modules.mjs'
import { extension, getNotifier, name as methodName, name, provides } from '../shared/methods.mjs'
import { getReferencedSchema, getLinkedSchemaPaths, getSchemaConstraints, isSchema, localizeDependencies, isDefinitionReferencedBySchema, getSafeEnumKeyName, getAllValuesForName } from '../shared/json-schema.mjs'
import Types from './types.mjs'

// util for visually debugging crocks ADTs
const _inspector = obj => {
  if (obj.inspect) {
    console.log(obj.inspect())
  } else {
    console.log(obj)
  }
}

let config = {
  copySchemasIntoModules: false,
  extractSubSchemas: false,
  unwrapResultObjects: false,
  excludeDeclarations: false,
}

const state = {
  typeTemplateDir: 'types'
}

const capitalize = str => str[0].toUpperCase() + str.substr(1)

const indent = (str, paddingStr, repeat = 1, endRepeat = 0) => {
  let first = true
  let padding = ''
  for (let i = 0; i < repeat; i++) {
    padding += paddingStr
  }

  let length = str.split('\n').length - 1
  let endPadding = ''
  for (let i = 0; length && i < endRepeat; i++) {
    endPadding += paddingStr
  }

  return str.split('\n').map((line, index) => {
    if (first) {
      first = false
      return line
    }
    else if (index === length && endPadding) {
      return endPadding + line
    }
    else {
      return padding + line
    }
  }).join('\n')
}

const setConfig = (c) => {
  config = c
}

const getTemplate = (name, templates) => {
  return templates[Object.keys(templates).find(k => k === name)] || templates[Object.keys(templates).find(k => k.startsWith(name + '.'))] || ''
}

const getTemplateTypeForMethod = (method, type, templates) => {
  const name = method.tags ? (isAllowFocusMethod(method) && Object.keys(templates).find(name => name.startsWith(`/${type}/allowsFocus.`))) ? 'allowsFocus' : (method.tags.map(tag => tag.name.split(":").shift()).find(tag => Object.keys(templates).find(name => name.startsWith(`/${type}/${tag}.`)))) || 'default' : 'default'
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
  const value = method.examples[0].result ? method.examples[0].result.value : method.examples[0].params.slice(-1)[0]?.value
  return template || JSON.stringify(value)
}

const getLinkForSchema = (schema, json) => {
  const dirs = config.createModuleDirectories
  const copySchemasIntoModules = config.copySchemasIntoModules
  const definitions = json.definitions || json.components.schemas

  const type = Types.getSchemaType(schema, json, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules })

  // local - insert a bogus link, that we'll update later based on final table-of-contents
  if (definitions && definitions[type]) {
    return `#\$\{LINK:schema:${type}\}`
  }
  else {
    const [group, schema] = Object.entries(definitions).find(([key, value]) => definitions[key] && definitions[key][type]) || [null, null]
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

const getComponentExternalSchema = (platformApi, appApi) => {
  const refSchemas = new Set();

  let externalSchemas;
  let isDefinitions = false;
  let titleLowercase;

  if (platformApi.definitions) {
    externalSchemas = platformApi.definitions;
    isDefinitions = true;
    titleLowercase = platformApi?.title?.toLowerCase();
  } else if (platformApi.components && platformApi.components.schemas && Object.keys(platformApi.components.schemas).length > 0) {
    externalSchemas = platformApi.components.schemas;
    titleLowercase = platformApi?.info?.title?.toLowerCase();
  } else if (appApi.components && appApi.components.schemas && Object.keys(appApi.components.schemas).length > 0) {
    externalSchemas = appApi.components.schemas;
    titleLowercase = appApi?.info?.title?.toLowerCase();
  } else {
    externalSchemas = {};
  }

  // Function to process references
  const processReferences = (schemas) => {
    Object.entries(schemas).forEach(([name, schema]) => {
      const refsFound = getAllValuesForName('$ref', schema);
      refsFound.forEach(ref => {
        if (ref.startsWith('https')) {
          const baseUrl = ref.split('#')[0];
          const schemaName = baseUrl.substring(baseUrl.lastIndexOf('/') + 1);
          if (schemaName) {
            refSchemas.add(schemaName);
          }
        }
      });
      if (name.startsWith('https')) {
        const schemaName = name.substring(name.lastIndexOf('/') + 1);
        refSchemas.add(schemaName)
      }
    });
  };

  if (isDefinitions) {
    // Remove all external schemas that start with https
    Object.keys(externalSchemas).forEach(name => {
      if (name.startsWith('https')) {
        delete externalSchemas[name];
      }
    });
  }

  // Process references for all schemas
  processReferences(externalSchemas);

  return Array.from(refSchemas);
};

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

const eventHasOptionalParam = (event) => {
  return event.params.length && event.params.find(param => !(param.required && param.required === true))
}

const isGlobalSubscriber = (method) => {
  return method.tags && method.tags.some(tag => tag['x-subscriber-type'] === 'global');
}

const isOptionalParam = (param) => {
  return (!(param.required && param.required === true))
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
      console.error(`ERROR: ${e.name} method is tagged as a provider, but does not match the pattern "on[A-Z]"`)
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

const getGlobalSubscribers = compose(
  option([]),
  map(filter(isGlobalSubscriber)),
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

const makeEventName = x => methodName(x)[2].toLowerCase() + methodName(x).substr(3) // onFooBar becomes fooBar
const makeProviderMethod = x => x.name["onRequest".length].toLowerCase() + x.name.substr("onRequest".length + 1) // onRequestChallenge becomes challenge

const generateAggregateMacros = (platformApi, appApi, additional, templates, library) => {
  return additional.reduce((acc, module) => {
    const infoMacros = generateInfoMacros(module)

    let template = getTemplate('/codeblocks/export', templates)
    if (template) {
      acc.exports += insertInfoMacros(template + '\n', infoMacros)
    }

    template = getTemplate('/codeblocks/mock-import', templates)
    if (template && module.info) {
      acc.mockImports += insertInfoMacros(template + '\n', infoMacros)
    }

    template = getTemplate('/codeblocks/mock-parameter', templates)
    if (template && module.info) {
      acc.mockObjects += insertInfoMacros(template + '\n', infoMacros)
    }

    return acc
  }, {
    exports: '',
    mockImports: '',
    mockObjects: '',
    version: getSemanticVersion(platformApi),
    library: library,
    unidirectional: !appApi
  })
}

const addContentDescriptorSubSchema = (descriptor, prefix, obj, destinationPath) => {
  const title = getPromotionNameFromContentDescriptor(descriptor, prefix)
  promoteSchema(descriptor, 'schema', title, obj, destinationPath)
}

const getPromotionNameFromContentDescriptor = (descriptor, prefix) => {
  const subtitle = descriptor.schema.title || descriptor.name.charAt(0).toUpperCase() + descriptor.name.substring(1)
  return (prefix ? prefix.charAt(0).toUpperCase() + prefix.substring(1) : '') + subtitle
}

const promoteSchema = (location, property, title, document, destinationPath) => {
  const destination = getReferencedSchema(destinationPath, document)
  destination[title] = location[property]
  destination[title].title = title
  location[property] = {
    $ref: `${destinationPath}/${title}`
  }
}

// only consider sub-objects and sub enums to be sub-schemas
const isSubSchema = (schema) => schema.type === 'object' || (schema.type === 'string' && schema.enum)

// check schema is sub enum of array
const isSubEnumOfArraySchema = (schema) => (schema.type === 'array' && schema.items.enum)

const promoteAndNameSubSchemas = (platformApi, appApi) => {
  const moduleTitle = platformApi.info ? platformApi.info.title : platformApi.title

  // make a copy so we don't pollute our inputs
  platformApi = JSON.parse(JSON.stringify(platformApi))

  // find anonymous method param or result schemas and name/promote them
  platformApi.methods && platformApi.methods.forEach(method => {
    method.params && method.params.forEach(param => {
      if (isSubSchema(param.schema)) {
        addContentDescriptorSubSchema(param, '', platformApi, '#/components/schemas')
      }
    })
    if (method.result && isSubSchema(method.result.schema)) {
      addContentDescriptorSubSchema(method.result, '', platformApi, '#/components/schemas')
    }
    else if (!appApi && isEventMethod(method) && isSubSchema(getPayloadFromEvent(method))) {
      // TODO: the `1` below is brittle... should find the index of the non-ListenResponse schema
      promoteSchema(method.result.schema.anyOf, 1, getPromotionNameFromContentDescriptor(method.result, ''), platformApi, '#/components/schemas')
    }
    else if (isEventMethod(method) && isSubSchema(getNotifier(method, appApi).params.slice(-1)[0])) {
      const notifier = getNotifier(method, appApi)
      promoteSchema(notifier.params[notifier.params.length - 1], 'schema', getPromotionNameFromContentDescriptor(notifier.params[notifier.params.length-1], ''), platformApi, '#/components/schemas')
    }

    if (method.tags.find(t => t['x-error'])) {
      method.tags.forEach(tag => {
        if (tag['x-error']) {
          const descriptor = {
              name: moduleTitle + 'Error',
              schema: tag['x-error']
          }
          addContentDescriptorSubSchema(descriptor, '', platformApi, '#/components/schemas')
        }
      })
    }
  })

  // Processes schemas to promote and name subschemas, handling nested objects and arrays.
  const processSchemas = (schemas, destinationPath, processSubDefs = true) => {
    let more = true;
    while (more) {
      more = false;
      Object.entries(schemas).forEach(([key, schema]) => {
        let componentSchemaProperties = schema.allOf ? schema.allOf : [schema];
        componentSchemaProperties.forEach((componentSchema) => {
          if ((componentSchema.type === "object") && componentSchema.properties) {
            Object.entries(componentSchema.properties).forEach(([name, propSchema]) => {
              if (isSubSchema(propSchema)) {
                more = true;
                const descriptor = {
                  name: name,
                  schema: propSchema
                };
                addContentDescriptorSubSchema(descriptor, key, platformApi, destinationPath);
                componentSchema.properties[name] = descriptor.schema;
              }
              if (isSubEnumOfArraySchema(propSchema)) {
                const descriptor = {
                  name: name,
                  schema: propSchema.items
                };
                addContentDescriptorSubSchema(descriptor, key, platformApi, destinationPath);
                componentSchema.properties[name].items = descriptor.schema;
              }
            });
          }
          // Handle external sub schema definitions
          if (componentSchema.definitions && processSubDefs) {
            processSchemas(
              componentSchema.definitions,
              key + '#/definitions',
              true
            );
          }
        });

        if (!schema.title) {
          schema.title = capitalize(key);
        }
      });
    }
  };

  // Process components.schemas
  if (platformApi.components && platformApi.components.schemas) {
    processSchemas(platformApi.components.schemas, '#/components/schemas')
  }

  // Process definitions
  if (platformApi.definitions) {
    processSchemas(platformApi.definitions, '#/definitions')
  }

  return platformApi
}

const generateMacros = (platformApi, appApi, templates, languages, options = {}) => {
  // for languages that don't support nested schemas, let's promote them to first-class schemas w/ titles

  if (config.extractSubSchemas) {
    platformApi = promoteAndNameSubSchemas(platformApi, appApi)
    if (appApi) {
      appApi = promoteAndNameSubSchemas(appApi)
    }
  }

  // grab the options so we don't have to pass them from method to method
  Object.assign(state, options)

  const macros = {
    schemas: {},
    types: {},
    enums: {},
    enum_implementations: {},
    methods: {},
    events: {},
    methodList: '',
    eventList: '',
    callsMetrics: false,
  }

  if (callsMetrics(platformApi)) {
    macros.callsMetrics = true
  }

  const unique = list => list.map((item, i) => Object.assign(item, { index: i })).filter( (item, i, list) => !(list.find(x => x.name === item.name) && list.find(x => x.name === item.name).index < item.index))

  Array.from(new Set(['types'].concat(config.additionalSchemaTemplates))).filter(dir => dir).forEach(dir => {
    state.typeTemplateDir = dir
    const schemasArray = unique(generateSchemas(platformApi, templates, { baseUrl: '' }).concat(generateSchemas(appApi, templates, { baseUrl: '' })))
    macros.schemas[dir] = getTemplate('/sections/schemas', templates).replace(/\$\{schema.list\}/g, schemasArray.map(s => s.body).filter(body => body).join('\n'))
    macros.types[dir] = getTemplate('/sections/types', templates).replace(/\$\{schema.list\}/g, schemasArray.filter(x => !x.enum).map(s => s.body).filter(body => body).join('\n'))
    macros.enums[dir] = getTemplate('/sections/enums', templates).replace(/\$\{schema.list\}/g, schemasArray.filter(x => x.enum).map(s => s.body).filter(body => body).join('\n'))
    macros.enum_implementations[dir] = getTemplate('/sections/enums', templates).replace(/\$\{schema.list\}/g, schemasArray.filter(x => x.enum).map(s => s.impl).filter(body => body).join('\n'))
  })

  state.typeTemplateDir = 'types'
  const imports = Object.fromEntries(Array.from(new Set(Object.keys(templates).filter(key => key.startsWith('/imports/')).map(key => key.split('.').pop()))).map(key => [key, generateImports(platformApi, appApi, templates, { destination: key })]))
  const initialization = generateInitialization(platformApi, appApi, templates)
  const eventsEnum = generateEvents(platformApi, templates)

  const examples = generateExamples(platformApi, templates, languages)
  const allMethodsArray = generateMethods(platformApi, appApi, examples, templates, languages, options.type)

  Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
    if (dir.includes('declarations')) {
      const declarationsArray = allMethodsArray.filter(m => m.declaration[dir] && (!config.excludeDeclarations || (!options.hideExcluded || !m.excluded)))
      macros.methods[dir] = declarationsArray.length ? getTemplate('/sections/declarations', templates).replace(/\$\{declaration\.list\}/g, declarationsArray.map(m => m.declaration[dir]).join('\n')) : ''
    }
    else if (dir.includes('methods')) {
      const publicMethodsArray = allMethodsArray.filter(m => m.body[dir] && !m.event && (!options.hideExcluded || !m.excluded) && !m.private)
      const privateMethodsArray = allMethodsArray.filter(m => m.body[dir] && !m.event && (!options.hideExcluded || !m.excluded) && m.private)
      const methodSection = (template, arr) => {
        const regex = template.endsWith('events') ? /\$\{event.list\}/g : /\$\{method.list\}/g
        return arr.length ? getTemplate('/sections/' + template, templates).replace(regex, arr.map(m => m.body[dir]).join('\n')) : ''
      }
      macros.methods.methods = methodSection('methods', publicMethodsArray)
      macros.methods.private = methodSection('private-methods', privateMethodsArray)

      const publicEventsArray = allMethodsArray.filter(m => m.body[dir] && m.event && (!options.hideExcluded || !m.excluded) && !m.private)
      const privateEventsArray = allMethodsArray.filter(m => m.body[dir] && m.event && (!options.hideExcluded || !m.excluded && m.private))
      macros.events.methods = methodSection('events', publicEventsArray)
      macros.events.private = methodSection('private-events', privateEventsArray)

      if (dir === 'methods') {
        macros.methodList = publicMethodsArray.filter(m => m.body).map(m => methodName(m))
        macros.eventList = publicEventsArray.map(m => makeEventName(m))
      }
    }
  })

  // if (platformApi?.info?.title === 'Discovery') {
  //   console.log('HERE')
  // }

  const xusesInterfaces = generateXUsesInterfaces(platformApi, templates)
  const providerSubscribe = generateProviderSubscribe(platformApi, appApi, templates, !!appApi)
  const providerInterfaces = generateProviderInterfaces(platformApi, appApi, templates, 'interface', 'interfaces', !!appApi)
  const providerClasses = generateProviderInterfaces(platformApi, appApi, templates, 'class', 'classes', !!appApi)
  const defaults = generateDefaults(platformApi, appApi, templates)

  const module = getTemplate('/codeblocks/module', templates)
  const moduleInclude = getTemplate('/codeblocks/module-include', templates)
  const moduleIncludePrivate = getTemplate('/codeblocks/module-include-private', templates)
  const moduleInit = Object.fromEntries(Array.from(new Set(Object.keys(templates).filter(key => key.startsWith('/imports/')).map(key => key.split('.').pop()))).map(key => [key, getTemplate(`/codeblocks/module-init.${key}`, templates)]))

  Object.assign(macros, {
    imports,
    initialization,
    eventsEnum,
    defaults,
    examples,
    xusesInterfaces,
    providerInterfaces,
    providerClasses,
    providerSubscribe,
    module: module,
    moduleInclude: moduleInclude,
    moduleIncludePrivate: moduleIncludePrivate,
    moduleInit: moduleInit,
    public: hasPublicAPIs(platformApi),
    unidirectional: !appApi
  })

  Object.assign(macros, generateInfoMacros(platformApi))


  return macros
}

const generateInfoMacros = (document) => {
  return {
    version: getSemanticVersion(document),
    title: document.title || document.info.title,
    description: document.info ? document.info.description : document.description
  }
}

const clearMacros = (fContents = '') => {
  fContents = fContents.replace(/\$\{module\.includes\}/g, "")
  fContents = fContents.replace(/\$\{module\.includes\.private\}/g, "")
  fContents = fContents.replace(/\$\{module\.init:h\}/g, "")
  fContents = fContents.replace(/\$\{module\.init:cpp\}/g, "")

  return fContents
}

const insertAggregateMacros = (fContents = '', aggregateMacros = {}) => {
  fContents = fContents.replace(/[ \t]*\/\* \$\{EXPORTS\} \*\/[ \t]*\n/, aggregateMacros.exports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_IMPORTS\} \*\/[ \t]*\n/, aggregateMacros.mockImports)
  fContents = fContents.replace(/[ \t]*\/\* \$\{MOCK_OBJECTS\} \*\/[ \t]*\n/, aggregateMacros.mockObjects)
  fContents = fContents.replace(/\$\{readable\}/g, aggregateMacros.version ? aggregateMacros.version.readable : '')
  fContents = fContents.replace(/\$\{package.name\}/g, aggregateMacros.library)
  fContents = fContents.replace(/\$\{if\.unidirectional\}(.*?)\$\{end\.if\.unidirectional\}/gms, aggregateMacros.unidirectional ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.bidirectional\}(.*?)\$\{end\.if\.bidirectional\}/gms, !aggregateMacros.unidirectional ? '$1' : '')
  
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
  fContents = fContents.replace(/\$\{if\.declarations\}(.*?)\$\{end\.if\.declarations\}/gms, (macros.methods.declarations && macros.methods.declarations.trim() || macros.enums.types.trim()) || macros.types.types.trim()? '$1' : '')
  fContents = fContents.replace(/\$\{if\.callsmetrics\}(.*?)\$\{end\.if\.callsmetrics\}/gms, macros.callsMetrics ? '$1' : '')

  fContents = fContents.replace(/\$\{module\.list\}/g, macros.module)
  fContents = fContents.replace(/\$\{module\.includes\}/g, macros.moduleInclude)
  fContents = fContents.replace(/\$\{module\.includes\.private\}/g, macros.moduleIncludePrivate)
 
  Object.keys(macros.moduleInit).forEach(key => {
    const regex = new RegExp('\\$\\{module\.init\\:' + key + '\\}', 'gms')
    fContents = fContents.replace(/\$\{module\.init\}/g, Object.values(macros.moduleInit)[key])

    fContents = fContents.replace(regex, macros.moduleInit[key])
  })  

  let methods = ''
  Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).every(dir => {
    if (macros.methods[dir]) {
      methods = macros.methods[dir]
      return false
    }
    return true
  })
  fContents = fContents.replace(/\$\{if\.methods\}(.*?)\$\{end\.if\.methods\}/gms, methods.trim() || macros.events.methods.trim() ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.implementations\}(.*?)\$\{end\.if\.implementations\}/gms, (methods.trim() || macros.events.methods.trim() || macros.schemas.types.trim()) ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.modules\}(.*?)\$\{end\.if\.modules\}/gms, (methods.trim() || macros.events.methods.trim()) ? '$1' : '')

  fContents = fContents.replace(/\$\{if\.xuses\}(.*?)\$\{end\.if\.xuses\}/gms, macros.xusesInterfaces.trim() ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.providers\}(.*?)\$\{end\.if\.providers\}/gms, macros.providerInterfaces.trim() ? '$1' : '')

  // Output the originally supported non-configurable methods & events macros
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHODS\} \*\/[ \t]*\n/, macros.methods.methods)
  fContents = fContents.replace(/[ \t]*\/\* \$\{PRIVATE_METHODS\} \*\/[ \t]*\n/, macros.methods.private)
  fContents = fContents.replace(/[ \t]*\/\* \$\{METHOD_LIST\} \*\/[ \t]*\n/, macros.methodList.join(',\n'))
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENTS\} \*\/[ \t]*\n/, macros.events.methods)
  fContents = fContents.replace(/[ \t]*\/\* \$\{PRIVATE_EVENTS\} \*\/[ \t]*\n/, macros.events.private)
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENT_LIST\} \*\/[ \t]*\n/, macros.eventList.join(','))
  fContents = fContents.replace(/[ \t]*\/\* \$\{EVENTS_ENUM\} \*\/[ \t]*\n/, macros.eventsEnum)

  // Output all declarations, methods & events with all dynamically configured templates
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
  fContents = fContents.replace(/[ \t]*\/\* \$\{ENUM_IMPLEMENTATIONS\} \*\/[ \t]*\n/, macros.enum_implementations.types)

  // Output all schemas with all dynamically configured templates
  Array.from(new Set(['types'].concat(config.additionalSchemaTemplates))).filter(dir => dir).forEach(dir => {
    ['SCHEMAS', 'TYPES', 'ENUMS'].forEach(type => {
      const regex = new RegExp('[ \\t]*\\/\\* \\$\\{' + type + '\\:' + dir + '\\} \\*\\/[ \\t]*\\n', 'g')
      fContents = fContents.replace(regex, macros[type.toLowerCase()][dir])
    })
  })

  // Output all imports with all dynamically configured templates
  Object.keys(macros.imports).forEach(key => {
    const regex = new RegExp('[ \\t]*\\/\\* \\$\\{IMPORTS\\:' + key + '\\} \\*\\/[ \\t]*\\n', 'g')
    fContents = fContents.replace(regex, macros.imports[key])
  })  

  fContents = fContents.replace(/[ \t]*\/\* \$\{PROVIDERS\} \*\/[ \t]*\n/, macros.providerInterfaces)
  fContents = fContents.replace(/[ \t]*\/\* \$\{PROVIDER_INTERFACES\} \*\/[ \t]*\n/, macros.providerInterfaces)
  fContents = fContents.replace(/[ \t]*\/\* \$\{PROVIDER_CLASSES\} \*\/[ \t]*\n/, macros.providerClasses)
  fContents = fContents.replace(/[ \t]*\/\* \$\{XUSES\} \*\/[ \t]*\n/, macros.xusesInterfaces)
  fContents = fContents.replace(/[ \t]*\/\* \$\{PROVIDERS_SUBSCRIBE\} \*\/[ \t]*\n/, macros.providerSubscribe)
  fContents = fContents.replace(/[ \t]*\/\* \$\{IMPORTS\} \*\/[ \t]*\n/, Object.values(macros.imports)[0])
  fContents = fContents.replace(/[ \t]*\/\* \$\{INITIALIZATION\} \*\/[ \t]*\n/, macros.initialization)
  fContents = fContents.replace(/[ \t]*\/\* \$\{DEFAULTS\} \*\/[ \t]*\n/, macros.defaults)
  fContents = fContents.replace(/\$\{events.array\}/g, JSON.stringify(macros.eventList))
  fContents = fContents.replace(/\$\{events\}/g, macros.eventList.map(e => `${quote}${e}${quote}`).join(or))
  fContents = fContents.replace(/\$\{major\}/g, macros.version.major)
  fContents = fContents.replace(/\$\{minor\}/g, macros.version.minor)
  fContents = fContents.replace(/\$\{patch\}/g, macros.version.patch)

  fContents = insertInfoMacros(fContents, macros)

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

  fContents = fContents.replace(/\$\{if\.unidirectional\}(.*?)\$\{end\.if\.unidirectional\}/gms, macros.unidirectional ? '$1' : '')
  fContents = fContents.replace(/\$\{if\.bidirectional\}(.*?)\$\{end\.if\.bidirectional\}/gms, !macros.unidirectional ? '$1' : '')

  fContents = insertTableofContents(fContents)

  return fContents
}

function insertInfoMacros(fContents, macros) {
  fContents = fContents.replace(/\$\{info\.title\}/g, macros.title)
  fContents = fContents.replace(/\$\{info\.title\.lowercase\}/g, macros.title.toLowerCase())
  fContents = fContents.replace(/\$\{info\.Title\}/g, capitalize(macros.title))
  fContents = fContents.replace(/\$\{info\.TITLE\}/g, macros.title.toUpperCase())
  fContents = fContents.replace(/\$\{info\.description\}/g, macros.description)
  fContents = fContents.replace(/\$\{info\.version\}/g, macros.version.readable)
  return fContents
}

function insertTableofContents(content) {
  let toc = ''
  const count = {}
  const slugger = title => title.toLowerCase().replace(/ /g, '-').replace(/-+/g, '-').replace(/[^a-zA-Z-]/g, '')
  let collapsedContentLevel = null

  content.split('\n').filter(line => line.match(/^\#/)).map(line => {
    const match = line.match(/^(\#+) (.*)/)
    if (match) {
      const level = match[1].length
      if (level > 1 && level < 4) {
        if (collapsedContentLevel === level) {
          // we are back to the level we started the collapsed content, end the collapse
          toc += ' ' + '  '.repeat(collapsedContentLevel) + '</details>\n'
          collapsedContentLevel = null
        }
        const title = match[2]
        const slug = slugger(title)
        if (count.hasOwnProperty(slug)) {
          count[slug] += 1
        }
        else {
          count[slug] = 0
        }
        const link = '#' + slug + (count[slug] ? `-${count[slug]}` : '')
        toc += ' ' + '  '.repeat(level - 1) + `- [${title}](${link})`
        if (title === 'Private Methods' || title === 'Private Events') {
          let anchor = title === 'Private Methods' ? 'private-methods-details' : 'private-events-details'
          toc += '<details ontoggle="document.getElementById(\'' + anchor + '\').open=this.open"><summary>Show</summary>\n'
          collapsedContentLevel = level
        } else {
          toc += '\n'
        }
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
      template[i] = enumSchema.enum.map((value, id) => {
        const safeName = getSafeEnumKeyName(value)
        return template[i].replace(/\$\{key\}/g, safeName)
          .replace(/\$\{value\}/g, value)
          .replace(/\$\{delimiter\}(.*?)\$\{end.delimiter\}/g, id === enumSchema.enum.length - 1 ? '' : '$1')
      }).join('\n')
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

const generateEnums = (json, templates, template = 'enum') => {
  return compose(
    option(''),
    map(val => {
      let output = val ? getTemplate(`/sections/enum`, templates) : val
      return output ? output.replace(/\$\{schema.list\}/g, val.trimEnd()) : val
    }),
    map(reduce((acc, val) => acc.concat(val).concat('\n'), '')),
    map(map((schema) => convertEnumTemplate(schema, `/types/${template}`, templates))),
    map(enumFinder),
    getSchemas
  )(json)
}

const generateEvents = (json, templates) => {
  const eventNames = eventsOrEmptyArray(json).map(x => makeEventName(x))

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

  return generateEnums(obj, templates, 'enum-implementation')
}

function generateDefaults(platformApi = {}, appApi, templates) {
  const reducer = compose(
    reduce((acc, val, i, arr) => {
      if (isPropertyMethod(val)) {
        acc += insertMethodMacros(getTemplate('/defaults/property', templates), val, platformApi, appApi, templates)
      } else if (val.tags.find(t => t.name === "setter")) {
        acc += insertMethodMacros(getTemplate('/defaults/setter', templates), val, platformApi, appApi, templates)
      } else {
        acc += insertMethodMacros(getTemplate('/defaults/default', templates), val, platformApi, appApi, templates)
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
  return reducer(platformApi)
}

function sortSchemasByReference(schemas = []) {
  let indexA = 0;
  while (indexA < schemas.length) {

    let swapped = false
    for (let indexB = indexA + 1; indexB < schemas.length; ++indexB) {
      const schemaBPath = '#/components/schemas/' + schemas[indexB][0];
      const schemaBDefinitionPath = '#/definitions/' + schemas[indexB][0];
      const bInA = isDefinitionReferencedBySchema(schemaBPath, schemas[indexA][1]) || isDefinitionReferencedBySchema(schemaBDefinitionPath, schemas[indexA][1]);
      
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

function generateSchemas(platformApi, templates, options) {
  let results = []

  if (!platformApi) {
    return results
  }

  const schemas = JSON.parse(JSON.stringify(platformApi.definitions || (platformApi.components && platformApi.components.schemas) || {}))


  const generate = (name, schema, uri, { prefix = '' } = {}) => {
    // these are internal schemas used by the fireboltize-openrpc tooling, and not meant to be used in code/doc generation
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

    // Schema title is requuired for proper documentation generation
    if (!schema.title) schema.title = name

    const schemaShape = Types.getSchemaShape(schema, platformApi, { templateDir: state.typeTemplateDir, primitive: config.primitives ? Object.keys(config.primitives).length > 0 : false, namespace: !config.copySchemasIntoModules })

    const schemaImpl = Types.getSchemaShape(schema, platformApi, { templateDir: state.typeTemplateDir, enumImpl: true, primitive: config.primitives ? Object.keys(config.primitives).length > 0 : false, namespace: !config.copySchemasIntoModules })
    
    content = content
      .replace(/\$\{schema.title\}/, (schema.title || name))
      .replace(/\$\{schema.description\}/, schema.description || '')

    if (schema.examples) {
      content = content.replace(/\$\{schema.example\}/, schema.examples.map(ex => JSON.stringify(ex, null, '  ')).join('\n\n'))
    }

    let seeAlso = getRelatedSchemaLinks(schema, platformApi, templates, options)
    if (seeAlso) {
      content = content.replace(/\$\{schema.seeAlso\}/, '\n\n' + seeAlso)
    }
    else {
      content = content.replace(/.*\$\{schema.seeAlso\}/, '')
    }
    content = content.trim().length ? content : content.trim()

    const impl = content.replace(/\$\{schema.shape\}/, schemaImpl)
    content = content.replace(/\$\{schema.shape\}/, schemaShape)

    const isEnum = x => x.type && Array.isArray(x.enum) && x.title && ((x.type === 'string') || (x.type[0]  === 'string'))

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

    if (isEnum(schema)) {
      result.impl = impl
    }

    if (result.name) {
      results.push(result)
    }
  }

  let list = []

  // schemas may be 1 or 2 levels deeps
  Object.entries(schemas).forEach(([name, schema]) => {
    if (isSchema(schema) && !schema.$id) {
      list.push([name, schema])
    }
    else if (platformApi.info && isSchema(schema) && schema.$id && schema.definitions) {
      if ( (config.mergeOnTitle && (schema.title === platformApi.info.title)) || config.copySchemasIntoModules) {
          Object.entries(schema.definitions).forEach( ([name, schema]) => {
            list.push([name, schema])
          })
        }
    }
  })

  list = sortSchemasByReference(list)
  list.forEach(item => {
    try {
      generate(...item)
    }
    catch (error) {
      console.error(error)
    }
  })

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
  .map(ref => getReferencedSchema(ref, json))
  .filter(schema => schema.title)
  .map(schema => '[' + Types.getSchemaType(schema, json, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules }) + '](' + getLinkForSchema(schema, json) + ')') // need full module here, not just the schema
  .filter(link => link)
  .join('\n')

return links
}

function getTemplateFromDestination(destination, templateName, templates) {
  const destinationArray = destination.split('/').pop().split(/[_.]+/)

  let template = ''
  destinationArray.filter(value => value).every((suffix) => {
    template = getTemplate(templateName +`.${suffix}`, templates)
    return template ? false: true
  })
  if (!template) {
      template = getTemplate(templateName, templates)
  }
  return template
}

const generateImports = (platformApi, appApi, templates, options = { destination: '' }) => {
  let imports = ''

  if (rpcMethodsOrEmptyArray(platformApi).length) {
    if (appApi) {
      imports += getTemplate('/imports/rpc', templates)
    }
    else {
      imports += getTemplate('/imports/unidirectional-rpc', templates)
    }
  }

  if (eventsOrEmptyArray(platformApi).length) {
    imports += getTemplate('/imports/event', templates)
  }

  if (eventsOrEmptyArray(platformApi).find(m => m.params.length > 1)) {
    imports += getTemplate('/imports/context-event', templates)
  }

  if (getInterfaces(appApi || platformApi).length) {
    if (appApi) {
      imports += getTemplate('/imports/provider', templates)
    } else {
      imports += getTemplate('/imports/unidirectional-provider', templates)      
    }
  }

  if (props(platformApi).length) {
    imports += getTemplate('/imports/property', templates)
  }

  if (temporalSets(platformApi).length) {
    imports += getTemplate('/imports/temporal-set', templates)
  }

  if (methodsWithXMethodsInResult(platformApi).length) {
    imports += getTemplate('/imports/x-method', templates)
  }

  if (callsMetrics(platformApi).length) {
    imports += getTemplateFromDestination(options.destination, '/imports/calls-metrics', templates)
  }

  let template = getTemplateFromDestination(options.destination, '/imports/default', templates)

  let componentExternalSchema = getComponentExternalSchema(platformApi, appApi)

  if (componentExternalSchema.length) {
    imports += componentExternalSchema.map(shared => template.replace(/\$\{info.title.lowercase\}/g, shared.toLowerCase())).join('')
  }

  // This just imports every module so not sure why it was included
  // const subschemas = getAllValuesForName("$id", platformApi)
  // // const subschemas = findLinkedSchemas(platformApi)

  // const subschemaLocation = platformApi.definitions || platformApi.components && platformApi.components.schemas || {}

  // // Remove top level 
  // subschemas.shift() // remove main $id

  // if (subschemas.length) {
  //   imports += subschemas.map(id => subschemaLocation[id].title).map(shared => template.replace(/\$\{info.title.lowercase\}/g, shared.toLowerCase())).join('')
  // }

  return imports
}

const generateInitialization = (platformApi, appApi, templates) => generateEventInitialization(platformApi, appApi, templates) + '\n' + generateProviderInitialization(appApi || platformApi, templates) + '\n' + generateDeprecatedInitialization(platformApi, appApi, templates)

const generateEventInitialization = (platformApi, appApi, templates) => {
  const events = eventsOrEmptyArray(platformApi)

  if (events.length > 0) {
    return getTemplate('/initializations/event', templates)
  }
  else {
    return ''
  }
}

const getProviderInterfaceNameFromRPC = name => name.charAt(9).toLowerCase() + name.substr(10) // Drop onRequest prefix

// TODO: this passes a JSON object to the template... might be hard to get working in non JavaScript languages.
// NEED TO FIGURE OUT IF THIS SHOULD BE CHANGED
const generateProviderInitialization = (document, templates) => {
  let result = ''
  const interfaces = getInterfaces(document)

  interfaces.forEach(_interface => {
    const methods = getProviderInterface(_interface, document)
    const capability = provides(methods[0])
    methods.forEach(method => {
      result += getTemplate('/initializations/provider', templates)
                  .replace(/\$\{capability\}/g, capability)
                  .replace(/\$\{interface\}/g, _interface)
                  .replace(/\$\{method\.name\}/g, name(method))
                  .replace(/\$\{method\.params\.array\}/g, JSON.stringify(method.params.map(p => p.name)))
                  .replace(/\$\{method\.focusable\}/g, ((method.tags.find(t => t['x-allow-focus']) || { 'x-allow-focus': false })['x-allow-focus']))
                  .replace(/\$\{method\.response\}/g, !!method.result)
    })
  })

  return result
}

const generateDeprecatedInitialization = (platformApi, appApi, templates) => {
  return compose(
    reduce((acc, method, i, arr) => {
      if (i === 0) {
        acc = ''
      }
      let alternative = method.tags.find(t => t.name === 'deprecated')['x-alternative'] || ''

      if (alternative && alternative.indexOf(' ') === -1) {
        alternative = `Use ${alternative} instead.`
      }

      // TODO: we're just inserting basic method info here... probably worth slicing up insertMethodMacros... it doesa TON of work
      return acc + insertMethodMacros(getTemplate('/initializations/deprecated', templates), method, platformApi, appApi, templates)
    }, ''),
    deprecatedOrEmptyArray
  )(platformApi)
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
        catch (error) {
          console.log(error)
         }
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

  Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
     const template = getTemplate(('/' + dir + '/' + type), templates)
     if (template) {
       if (dir.includes('declarations')) {
         result.declaration[dir] = template
       }
       else if (dir.includes('methods')) {
         result.body[dir] = template
       }
     }
  })
  return result
}

function generateMethods(platformApi = {}, appApi = null, examples = {}, templates = {}, languages = [], type = '') {
  const methods = compose(
    option([]),
    getMethods
  )(platformApi)

  // Code to generate methods
  const results = reduce((acc, methodObj, i, arr) => {
    const result = {
      name: methodObj.name,
      body: {},
      declaration: {},
      excluded: methodObj.tags.find(t => t.name === 'exclude-from-sdk'),
      event: isEventMethod(methodObj),
      examples: generateExamples(methodObj, templates, languages)
    }

    // Generate implementation of methods/events for both dynamic and static configured templates
    Array.from(new Set(['methods'].concat(config.additionalMethodTemplates))).filter(dir => dir).forEach(dir => {
      if (dir.includes('declarations')) {
        const template = getTemplateForDeclaration(methodObj, templates, dir)
        if (template && template.length) {
          result.declaration[dir] = insertMethodMacros(template, methodObj, platformApi, appApi, templates, '', examples)
        }
      }
      else if (dir.includes('methods')) {
        const template = getTemplateForMethod(methodObj, templates, dir)
        if (template && template.length) {
          result.body[dir] = insertMethodMacros(template, methodObj, platformApi, appApi, templates, type, examples, languages)
        }
      }
    })

    acc.push(result)

    return acc
  }, [], methods)

  // TODO: might be useful to pass in local macro for an array with all event names
  if (platformApi.methods && platformApi.methods.find(isPublicEventMethod)) {
    ['listen', 'once', 'clear'].forEach(type => {
      results.push(generateMethodResult(type, templates))
    })
  }

  if (platformApi.methods && platformApi.methods.find(isProviderInterfaceMethod)) {
    ['provide'].forEach(type => {
      results.push(generateMethodResult(type, templates))
    })
  }  

  results.sort((a, b) => a.name.localeCompare(b.name))
  return results
}

const getNonNullSchema = (methodObj, event, platformApi, document) => {
  if (event) {
    const schema = event?.result?.schema;
    if (schema && !schema['$ref']) {
      return schema;
    } else if (schema && schema['$ref']) {
      let referencedSchema = getReferencedSchema(schema['$ref'], platformApi);
      if (!referencedSchema) {
        referencedSchema = getReferencedSchema(schema['$ref'], document);
      }
      if (referencedSchema) {
        return referencedSchema;
      }
    }
  }
  
  if (methodObj.tags) {
    const tag = methodObj.tags.find(tag => tag['x-subscriber-for'] || tag['x-notifier']);
    if (tag) {
      let value = tag['x-subscriber-for'] || tag['x-notifier'];
      // Capitalize the first letter after each dot
      if (value) {
        value = value.split('.').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join('.');
        
        // Search in platformApi.definitions or platformApi.components.schemas
        const schemas = platformApi.definitions || (platformApi.components && platformApi.components.schemas) || {};
        let schemaKey = Object.keys(schemas).find(key => key === value);

        if (schemaKey) {
          return schemas[schemaKey];
        }

        // If no match at the top level, check inside each schema's definitions
        const valueAfterDot = value.split('.').pop();
        for (const schema of Object.values(schemas)) {
          if (schema.definitions) {
            schemaKey = Object.keys(schema.definitions).find(key => key === valueAfterDot);
            if (schemaKey) {
              return schema.definitions[schemaKey];
            }
          }
        }

        // Check in platformApi.methods
        if (platformApi.methods) {
          const method = platformApi.methods.find(method => method.name.toLowerCase() === valueAfterDot.toLowerCase());
          if (method && method.result && method.result.schema) {
            return method.result.schema;
          }
        }
      }
    }
  }
  return { type: 'null' };
}

// TODO: this is called too many places... let's reduce that to just generateMethods
function insertMethodMacros(template, methodObj, platformApi, appApi, templates, type = 'method', examples = [], languages = {}) {
  const document = appApi || platformApi
  const moduleName = getModuleName(platformApi)
  const info = {
    title: moduleName
  }
  const method = {
    name: methodObj.name.split('.').pop(),
    params: methodObj.params.map(p => p.name).join(', '),
    transforms: null,
    transform: '',
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
  else if (extension(methodObj, 'x-subscriber-for')) {
    method.alternative = extension(methodObj, 'x-subscriber-for')
  }

  const flattenedMethod = localizeDependencies(methodObj, platformApi)

  if (hasMethodAttributes(flattenedMethod)) {
    method.transforms = {
      methods: getMethodAttributes(flattenedMethod)
    }
    method.transform = getTemplate('/codeblocks/transform', templates).replace(/\$\{transforms\}/g, JSON.stringify(method.transforms))
  }

  const paramDelimiter = config.operators ? config.operators.paramDelimiter : ''

  const temporalItemName = isTemporalSetMethod(methodObj) ? methodObj.result.schema.items && methodObj.result.schema.items.title || 'Item' : ''
  const temporalAddName = isTemporalSetMethod(methodObj) ? `on${temporalItemName}Available` : ''
  const temporalRemoveName = isTemporalSetMethod(methodObj) ? `on${temporalItemName}Unvailable` : ''
  const params = methodObj.params && methodObj.params.length ? getTemplate('/sections/parameters', templates) + methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, methodObj, platformApi)).join(paramDelimiter) : ''
  const paramsRows = methodObj.params && methodObj.params.length ? methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, methodObj, platformApi)).join('') : ''
  const paramsAnnotations = methodObj.params && methodObj.params.length ? methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/annotations', templates), p, methodObj, platformApi)).join('') : ''
  const paramsJson = methodObj.params && methodObj.params.length ? methodObj.params.map(p => insertParameterMacros(getTemplate('/parameters/json', templates), p, methodObj, platformApi)).join('') : ''

  const deprecated = methodObj.tags && methodObj.tags.find(t => t.name === 'deprecated')
  const deprecation = deprecated ? deprecated['x-since'] ? `since version ${deprecated['x-since']}` : '' : ''

  const capabilities = getTemplate('/sections/capabilities', templates) + insertCapabilityMacros(getTemplate('/capabilities/default', templates), methodObj.tags.find(t => t.name === "capabilities"), methodObj, platformApi)

  const result = methodObj.result && JSON.parse(JSON.stringify(methodObj.result))
  const event = methodObj.providerEvent ?  JSON.parse(JSON.stringify(methodObj.providerEvent)) :  isEventMethod(methodObj) ? JSON.parse(JSON.stringify(methodObj)) : ''
  
  // Keep track of any global subscribers to insert into templates
  const globalSubscribersArr = getGlobalSubscribers(platformApi);
  let isGlobalSubscriberEvent = false

  if (event) {
    isGlobalSubscriberEvent = globalSubscribersArr.some(subscriber => {
      const strippedEventName = event.name.replace(/^on/, '').replace(/Changed$/, '').toLowerCase();
      const subscriberName = subscriber.name.toLowerCase();
      return subscriberName && strippedEventName === subscriberName;
    })
    
    if (!appApi) {
      result.schema = JSON.parse(JSON.stringify(getPayloadFromEvent(methodObj)))
      event.result.schema = getPayloadFromEvent(event)
    } else {
      const notifier = getNotifier(methodObj, appApi)
      event.result = notifier.params.slice(-1)[0]
    }

    event.params = event.params.filter(p => p.name !== 'listen')
  }

  const eventParams = event.params && event.params.length ? getTemplate('/sections/parameters', templates) + event.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, event, document)).join('') : ''

  const eventParamsRows = event.params && event.params.length ? event.params.map(p => insertParameterMacros(getTemplate('/parameters/default', templates), p, event, document)).join('') : ''

  let itemName = ''
  let itemType = ''

  // grab some related methods in case they are output together in a single template file
  const puller = platformApi.methods.find(method => method.tags.find(tag => tag['x-pulls-for'] === methodObj.name))
  const pullsFor = methodObj.tags.find(t => t['x-pulls-for']) && platformApi.methods.find(method => method.name === methodObj.tags.find(t => t['x-pulls-for'])['x-pulls-for'].split('.').pop());  const pullerTemplate = (puller ? insertMethodMacros(getTemplate('/codeblocks/puller', templates), puller, platformApi, appApi, templates, type, examples) : '')
  const setter = getSetterFor(methodObj.name, platformApi)
  const setterTemplate = (setter ? insertMethodMacros(getTemplate('/codeblocks/setter', templates), setter, platformApi, appApi, templates, type, examples) : '')
  const subscriber = platformApi.methods.find(method => method.tags.find(tag => tag['x-alternative'] === methodObj.name))
  const subscriberTemplate = (subscriber ? insertMethodMacros(getTemplate('/codeblocks/subscriber', templates), subscriber, platformApi, appApi, templates, type, examples) : '')
  const setterFor = methodObj.tags.find(t => t.name === 'setter') && methodObj.tags.find(t => t.name === 'setter')['x-setter-for'] || ''

  const pullsResult = (puller || pullsFor) ? localizeDependencies(pullsFor || methodObj, platformApi).params.findLast(x=>true).schema : null
  const pullsParams = (puller || pullsFor) ? localizeDependencies(getPayloadFromEvent(puller || methodObj, document), document, null, { mergeAllOfs: true }).properties.parameters : null

  const pullsResultType = (pullsResult && (type === 'methods')) ? Types.getSchemaShape(pullsResult, platformApi, { templateDir: state.typeTemplateDir, namespace: false }) : ''
  const pullsForType = pullsResult && Types.getSchemaType(pullsResult, platformApi, { templateDir: state.typeTemplateDir, namespace: false })
  const pullsParamsType = (pullsParams && (type === 'methods')) ? Types.getSchemaShape(pullsParams, platformApi, { templateDir: state.typeTemplateDir, namespace: false }) : ''
  const pullsForParamTitle = pullsParams ? pullsParams.title.charAt(0).toLowerCase() + pullsParams.title.substring(1) : ''
  const pullsForResultTitle = (pullsResult && pullsResult.title) ? pullsResult.title.charAt(0).toLowerCase() + pullsResult.title.substring(1) : ''
  const pullsResponseInit = (pullsParams && (type === 'methods')) ? Types.getSchemaShape(pullsParams, platformApi, { templateDir: 'result-initialization', property: pullsForParamTitle, required: pullsParams.required, primitive: true, skipTitleOnce: true, namespace: false }) : ''
  const pullsResponseInst = (pullsParams && (type === 'methods')) ? Types.getSchemaShape(pullsParams, platformApi, { templateDir: 'result-instantiation', property: pullsForParamTitle, required: pullsParams.required, primitive: true, skipTitleOnce: true, namespace: false }) : ''
  const pullsResultSerialize = (pullsResult && (type === 'methods')) ? Types.getSchemaShape(pullsResult, platformApi, { templateDir: 'parameter-serialization/sub-property', property: pullsForResultTitle, required: pullsResult.required, primitive: true, skipTitleOnce: true, namespace: false }) : ''

  const serializedParams = (type === 'methods') ? flattenedMethod.params.map(param => Types.getSchemaShape(param.schema, platformApi, { templateDir: 'parameter-serialization', property: param.name, required: param.required, primitive: true, skipTitleOnce: true, namespace: true })).join('\n') : ''
  const resultInst = (type === 'methods') ? Types.getSchemaShape(flattenedMethod.result.schema, platformApi, { templateDir: 'result-instantiation', property: flattenedMethod.result.name, required: flattenedMethod.result.required, primitive: true, skipTitleOnce: true, namespace: false }) : '' // w/out primitive: true, getSchemaShape skips anonymous types, like primitives
  const resultInit = (type === 'methods') ? Types.getSchemaShape(flattenedMethod.result.schema, platformApi, { templateDir: 'result-initialization', property: flattenedMethod.result.name, primitive: true, skipTitleOnce: true, namespace: true }) : '' // w/out primitive: true, getSchemaShape skips anonymous types, like primitives
  const serializedEventParams = event && (type === 'methods') ? flattenedMethod.params.filter(p => p.name !== 'listen').map(param => Types.getSchemaShape(param.schema, document, {templateDir: 'parameter-serialization', property: param.name, required: param.required, primitive: true, skipTitleOnce: true, namespace: false })).join('\n') : ''
  const callbackSerializedList = event && (type === 'methods') ? Types.getSchemaShape(event.result.schema, document, { templateDir: eventHasOptionalParam(event) && !event.tags.find(t => t.name === 'provider') ? 'callback-result-serialization' : 'callback-result-serialization', property: result.name, required: event.result.schema.required, primitive: true, skipTitleOnce: true, namespace: false }) : ''
  const callbackInitialization = event && (type === 'methods') ? (eventHasOptionalParam(event) && !event.tags.find(t => t.name === 'provider') ? (event.params.map(param => isOptionalParam(param) ? Types.getSchemaShape(param.schema, document, { templateDir: 'callback-initialization-optional', property: param.name, required: param.required, primitive: true, skipTitleOnce: true }) : '').filter(param => param).join('\n') + '\n') : '' ) + (Types.getSchemaShape(event.result.schema, document, { templateDir: 'callback-initialization', property: result.name, primitive: true, skipTitleOnce: true, namespace: false  })) : ''
  let callbackInstantiation = ''
  if (event) {
    if (eventHasOptionalParam(event) && !event.tags.find(t => t.name === 'provider'))  {
      callbackInstantiation = (type === 'methods') ? Types.getSchemaShape(event.result.schema, document, { templateDir: 'callback-instantiation', property: result.name, primitive: true, skipTitleOnce: true, namespace: false  }) : ''
      let paramInstantiation = (type === 'methods') ? event.params.map(param => isOptionalParam(param) ? Types.getSchemaShape(param.schema, document, { templateDir: 'callback-context-instantiation', property: param.name, required: param.required, primitive: true, skipTitleOnce: true, namespace: false  }) : '').filter(param => param).join('\n') : ''
      let resultInitialization = (type === 'methods') ? Types.getSchemaShape(event.result.schema, document, { templateDir: 'callback-value-initialization', property: result.name, primitive: true, skipTitleOnce: true, namespace: false  }) : ''
      let resultInstantiation = (type === 'methods') ? Types.getSchemaShape(event.result.schema, document, { templateDir: 'callback-value-instantiation', property: result.name, primitive: true, skipTitleOnce: true, namespace: false  }) : ''
      callbackInstantiation = callbackInstantiation
        .replace(/\$\{callback\.param\.instantiation\.with\.indent\}/g, indent(paramInstantiation, '    ', 3))
        .replace(/\$\{callback\.result\.initialization\.with\.indent\}/g, indent(resultInitialization, '    ', 1))
        .replace(/\$\{callback\.result\.instantiation\}/g, resultInstantiation)
    }
    else {
      callbackInstantiation = (type === 'methods') ? Types.getSchemaShape(event.result.schema, document, { templateDir: 'callback-result-instantiation', property: result.name, primitive: true, skipTitleOnce: true, namespace: false  }) : ''
    }
  }
  // hmm... how is this different from callbackSerializedList? i guess they get merged?
  const callbackResponseInst = event && (type === 'methods') ? (eventHasOptionalParam(event) ? (event.params.map(param => isOptionalParam(param) ? Types.getSchemaShape(param.schema, document, { templateDir: 'callback-response-instantiation', property: param.name, required: param.required, primitive: true, skipTitleOnce: true, namespace: false  }) : '').filter(param => param).join(', ') + ', ') : '' ) + (Types.getSchemaShape(event.result.schema, document, { templateDir: 'callback-response-instantiation', property: result.name, primitive: true, skipTitleOnce: true })) : ''
  const resultType = result.schema ? Types.getSchemaType(result.schema, platformApi, { templateDir: state.typeTemplateDir, namespace: false }) : ''
  const resultSchemaType = result.schema.type
  const resultJsonType = result.schema ? Types.getSchemaType(result.schema, platformApi, { templateDir: 'json-types', namespace: true  }) : ''
  
  try {
    generateResultParams(result.schema, platformApi, templates, { name: result.name})
  } catch (e) {
    console.dir(methodObj)    
  }

  const resultParams = result && generateResultParams(result.schema, platformApi, templates, { name: result.name})

  // todo: what does prefix do in Types.mjs? need to account for it somehow
  const callbackResultJsonType = event && result.schema ? Types.getSchemaType(result.schema, document, { templateDir: 'json-types', namespace: false }) : ''

  const pullsForParamType = pullsParams ? Types.getSchemaType(pullsParams, platformApi, { namespace: false}) : ''
  const pullsForJsonType = pullsResult ? Types.getSchemaType(pullsResult, platformApi, { templateDir: 'json-types', namespace: false}) : ''
  const pullsForParamJsonType = pullsParams ? Types.getSchemaType(pullsParams, platformApi, { templateDir: 'json-types', namespace: false }) : ''
  
  const pullsEventParamName = event ? Types.getSchemaInstantiation(event.result, document, event.name, { instantiationType: 'pull.param.name', namespace: false}) : ''

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
    itemType = Types.getSchemaType(result.schema.items, platformApi, { templateDir: state.typeTemplateDir, namespace: false})
  }

  let signature
  
  if (Object.keys(languages).length && template.indexOf('${method.signature}') >= 0) {
    const lang = languages[Object.keys(languages)[0]]
    signature = getTemplateForDeclaration(methodObj, templates, 'declarations')
    Types.setTemplates(lang)
    const currentConfig = JSON.parse(JSON.stringify(config))
    config.operators = config.operators || {}
    config.operators.paramDelimiter = ', '
    signature = insertMethodMacros(signature, methodObj, platformApi, appApi, lang, type)
    config = currentConfig
    Types.setTemplates(templates)
  }
  else {
    signature = ''
  }

  template = insertExampleMacros(template, examples || [], methodObj, platformApi, templates)

  template = template.replace(/\$\{method\.name\}/g, method.name)
    .replace(/\$\{method\.rpc\.name\}/g, methodObj.rpc_name || methodObj.name)
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
    .replace(/\$\{if\.result.nonboolean\}(.*?)\$\{end\.if\.result.nonboolean\}/gms, resultSchemaType && resultSchemaType !== 'boolean' ? '$1' : '')
    .replace(/\$\{if\.result\.properties\}(.*?)\$\{end\.if\.result\.properties\}/gms, resultParams ? '$1' : '')
    .replace(/\$\{if\.params\.empty\}(.*?)\$\{end\.if\.params\.empty\}/gms, method.params.length === 0 ? '$1' : '')
    .replace(/\$\{if\.signature\.empty\}(.*?)\$\{end\.if\.signature\.empty\}/gms, (method.params.length === 0 && resultType === '') ? '$1' : '')
    .replace(/\$\{if\.context\}(.*?)\$\{end\.if\.context\}/gms, event && event.params.length ? '$1' : '')
    .replace(/\$\{method\.params\.serialization\}/g, serializedParams)
    .replace(/\$\{method\.params\.serialization\.with\.indent\}/g, indent(serializedParams, '    '))
    // Typed signature stuff
    .replace(/\$\{method\.signature\}/g, signature)
    .replace(/\$\{method\.signature\.params\}/g, Types.getMethodSignatureParams(methodObj, platformApi, { namespace: !config.copySchemasIntoModules }))
    .replace(/\$\{method\.signature\.result\}/g, Types.getMethodSignatureResult(methodObj, platformApi, { namespace: !config.copySchemasIntoModules }))
    .replace(/\$\{method\.context\}/g, method.context.join(', '))
    .replace(/\$\{method\.context\.array\}/g, JSON.stringify(method.context))
    .replace(/\$\{method\.context\.count}/g, method.context ? method.context.length : 0)
    .replace(/\$\{method\.deprecation\}/g, deprecation)
    .replace(/\$\{method\.Name\}/g, method.name[0].toUpperCase() + method.name.substr(1))
    .replace(/\$\{event\.name\}/g, method.name.toLowerCase()[2] + method.name.substr(3))
    .replace(/\$\{event\.params\}/g, eventParams)
    .replace(/\$\{event\.params\.table\.rows\}/g, eventParamsRows)
    .replace(/\$\{if\.event\.params\}(.*?)\$\{end\.if\.event\.params\}/gms, event && event.params.length ? '$1' : '')
    .replace(/\$\{if\.globalsubscriber\}(.*?)\$\{end\.if\.globalsubscriber\}/gms, (isGlobalSubscriberEvent) ? '$1' : '')
    .replace(/\$\{if\.event\.callback\.params\}(.*?)\$\{end\.if\.event\.callback\.params\}/gms, event && eventHasOptionalParam(event) ? '$1' : '')
    .replace(/\$\{event\.signature\.params\}/g, event ? Types.getMethodSignatureParams(event, document, { namespace: !config.copySchemasIntoModules }) : '')
    .replace(/\$\{event\.signature\.callback\.params\}/g, event ? Types.getMethodSignatureParams(event, document, { callback: true, namespace: !config.copySchemasIntoModules }) : '')
    .replace(/\$\{event\.params\.serialization\}/g, serializedEventParams)
    .replace(/\$\{event\.callback\.serialization\}/g, callbackSerializedList)
    .replace(/\$\{event\.callback\.initialization\}/g, callbackInitialization)
    .replace(/\$\{event\.callback\.instantiation\}/g, callbackInstantiation)
    .replace(/\$\{event\.callback\.response\.instantiation\}/g, callbackResponseInst)
    .replace(/\$\{info\.title\.lowercase\}/g, info.title.toLowerCase())
    .replace(/\$\{info\.title\}/g, info.title)
    .replace(/\$\{info\.Title\}/g, capitalize(info.title))
    .replace(/\$\{info\.TITLE\}/g, info.title.toUpperCase())
    .replace(/\$\{method\.property\.immutable\}/g, hasTag(methodObj, 'property:immutable'))
    .replace(/\$\{method\.property\.readonly\}/g, !getSetterFor(methodObj.name, platformApi))
    .replace(/\$\{method\.temporalset\.add\}/g, temporalAddName)
    .replace(/\$\{method\.temporalset\.remove\}/g, temporalRemoveName)
    .replace(/\$\{method\.transforms}/g, JSON.stringify(method.transforms))
    .replace(/\$\{method\.seeAlso\}/g, seeAlso)
    .replace(/\$\{method\.item\}/g, itemName)
    .replace(/\$\{method\.item\.type\}/g, itemType)
    .replace(/\$\{method\.capabilities\}/g, capabilities)
    .replace(/\$\{method\.result\.name\}/g, result.name)
    .replace(/\$\{method\.result\.summary\}/g, result.summary)
    .replace(/\$\{method\.result\.link\}/g, getLinkForSchema(result.schema, platformApi)) //, baseUrl: options.baseUrl
    .replace(/\$\{method\.result\.type\}/g, Types.getSchemaType(result.schema, platformApi, { templateDir: state.typeTemplateDir, title: true, asPath: false, result: true, namespace: false  })) //, baseUrl: options.baseUrl    
    .replace(/\$\{method\.result\.json\}/g, Types.getSchemaType(result.schema.type === 'null' ? getNonNullSchema(methodObj, event, platformApi, document) : result.schema, platformApi, { templateDir: 'json-types', title: true, code: false, link: false, asPath: false, expandEnums: false, namespace: true  }))
    // todo: what does prefix do?
    .replace(/\$\{event\.result\.type\}/g, isEventMethod(methodObj) ? Types.getMethodSignatureResult(event, document, { callback: true, namespace: false  }) : '')
    .replace(/\$\{event\.result\.json\.type\}/g, resultJsonType)
    .replace(/\$\{event\.result\.json\.type\}/g, callbackResultJsonType)
    .replace(/\$\{event\.pulls\.param\.name\}/g, pullsEventParamName)
    .replace(/\$\{method\.result\}/g, generateResult(result.schema, platformApi, templates, { name: result.name }))
    .replace(/\$\{method\.result\.json\.type\}/g, resultJsonType)
    .replace(/\$\{method\.result\.instantiation\}/g, resultInst)
    .replace(/\$\{method\.result\.initialization\}/g, resultInit)
    .replace(/\$\{method\.result\.properties\}/g, resultParams)
    .replace(/\$\{method\.result\.instantiation\.with\.indent\}/g, indent(resultInst, '    '))
    .replace(/\$\{method\.example\.value\}/g, JSON.stringify(methodObj.examples[0].result.value))
    .replace(/\$\{method\.alternative\}/g, method.alternative)
    .replace(/\$\{method\.alternative.link\}/g, '#' + (method.alternative || "").toLowerCase())
    .replace(/\$\{method\.pulls\.for\}/g, pullsFor ? pullsFor.name : '')
    .replace(/\$\{method\.pulls\.type\}/g, pullsForType)
    .replace(/\$\{method\.pulls\.json\.type\}/g, pullsForJsonType)
    .replace(/\$\{method\.pulls\.result\}/g, pullsResultType)
    .replace(/\$\{method\.pulls\.result\.title\}/g, pullsForResultTitle)
    .replace(/\$\{method\.pulls\.params.type\}/g, pullsParams ? pullsParams.title : '')
    .replace(/\$\{method\.pulls\.params\}/g, pullsParamsType)
    .replace(/\$\{method\.pulls\.param\.type\}/g, pullsForParamType)
    .replace(/\$\{method\.pulls\.param\.title\}/g, pullsForParamTitle)
    .replace(/\$\{method\.pulls\.param\.json\.type\}/g, pullsForParamJsonType)
    .replace(/\$\{method\.pulls\.response\.initialization\}/g, pullsResponseInit)
    .replace(/\$\{method\.pulls\.response\.instantiation}/g, pullsResponseInst)
    .replace(/\$\{method\.pulls\.result\.serialization\.with\.indent\}/g, indent(pullsResultSerialize, '    ', 3, 2))
    .replace(/\$\{method\.setter\.for\}/g, setterFor)
    .replace(/\$\{method\.puller\}/g, pullerTemplate) // must be last!!
    .replace(/\$\{method\.setter\}/g, setterTemplate) // must be last!!
    .replace(/\$\{method\.subscriber\}/g, subscriberTemplate) // must be last!!


  if (method.deprecated) {
    if (method.alternative) {
      template = template.replace(/\$\{if\.method\.alternative\}(.*?)\$\{end\.if\.method\.alternative\}/gms, '$1')
    }
    template = template.replace(/\$\{if\.deprecated\}(.*?)\$\{end\.if\.deprecated\}/gms, '$1')
    template = template.replace(/\$\{if\.not\.deprecated\}(.*?)\$\{end\.if\.not\.deprecated\}/gms, '')
  }
  else {
    template = template.replace(/\$\{if\.deprecated\}(.*?)\$\{end\.if\.deprecated\}/gms, '')
    template = template.replace(/\$\{if\.not\.deprecated\}(.*?)\$\{end\.if\.not\.deprecated\}/gms, '$1')
  }

  // method.params[n].xxx macros
  const matches = [...template.matchAll(/\$\{method\.params\[([0-9]+)\]\.type\}/g)]
  matches.forEach(match => {
    const index = parseInt(match[1])
    template = template.replace(/\$\{method\.params\[([0-9]+)\]\.type\}/g, Types.getSchemaType(methodObj.params[index].schema, platformApi, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules  }))
    template = template.replace(/\$\{method\.params\[([0-9]+)\]\.name\}/g, methodObj.params[index].name)
  })

  // Note that we do this twice to ensure all recursive macros are resolved
  template = insertExampleMacros(template, examples || [], methodObj, platformApi, templates)

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
  Object.keys(examples).forEach(key => {
    examples[key].forEach(example => {
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

        /**
         * Formats method parameters into a string, replacing optional empty values with `undefined`
         * and removing trailing empty values.
         * 
         * @param {Array<Object>} params - The parameters to format.
         * @param {string} delimit - The delimiter to use between parameters.
         * @param {boolean} [pretty=false] - Whether to format output with pretty indentation.
         * @returns {string} - A formatted string of parameters.
         */
        const formatParams = (params, delimit, pretty = false) => {
          const formattedParams = params.map((p, index) => {
            // Retrieve parameter value or default to empty string if not found
            const param = example.json.params.find(x => x.name === p.name) || { value: '' };
            let value = param.value === '' ? (index === params.length - 1 ? null : "undefined") : param.value;
            
            // Remove trailing parameter if empty
            if (index === params.length - 1 && value === null) {
              return null;
            }
            
            // Return "undefined" as a literal or format the value as JSON
            return value === "undefined" ? "undefined" : JSON.stringify(value, null, pretty ? '  ' : null);
          });

          // Join parameters, filtering out trailing empty parameters
          return formattedParams.filter(p => p !== null).join(delimit);
        }

        /**
         * Generates formatted parameters for documentation, adjusting line indentation
         * for readability if it exceeds a given line length.
         * 
         * @param {Object} method - The method containing parameters to format.
         * @param {string} [delimit=', '] - The delimiter between parameters.
         * @param {number} [maxLineLength=80] - The maximum line length before wrapping.
         * @returns {string} - A formatted and indented string of method parameters.
         */
        const generateParamsWithIndentation = (method, delimit = ', ', maxLineLength = 80) => {
          const indent = ' '.repeat(json.info.title.length + method.name.length + 2);
          let params = formatParams(method.params, delimit);

          // Reformat parameters if they exceed max line length
          if (params.length + indent > maxLineLength) {
            params = formatParams(method.params, ',\n', true);
            params = params.split('\n');

            let first = params.shift()
            params = params.map(p => indent + p)
            params.unshift(first)
            params = params.join('\n')
          }
          
          return params;
        }
        
        const params = generateParamsWithIndentation(method);

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
  })


  return template.replace(/\$\{method\.examples\}/g, content)
}

function generateResult(result, json, templates, { name = '' } = {}) {

  const type = Types.getSchemaType(result, json, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules  })

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
      return `[${Types.getSchemaType(result, json, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules })}](${link})`
    }
    // otherwise this was a schema with no title, and we'll just copy it here
    else {
      const schema = localizeDependencies(result, json)
      return getTemplate('/types/default', templates)
        .replace(/\$\{type\}/, Types.getSchemaShape(schema, json, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules  }))
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
    result = getReferencedSchema(result.$ref, json)
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
                                                                      .replace(/\$\{method\.param\.type\}/g, Types.getSchemaType(type, json, { moduleTitle: moduleTitle, result: true, namespace: !config.copySchemasIntoModules }))
    ).join(', ') // most languages separate params w/ a comma, so leaving this here for now  
  }
  // tuples get unwrapped
  else if (config.unwrapResultObjects && result.type && result.type === 'array' && Array.isArray(result.items)) {
    // TODO: this is hard coded to C
    const template = getTemplate('/parameters/result', templates)
    return result.items.map( (type) => template
                                        .replace(/\$\{method\.param\.name\}/g, type['x-property'])
                                        .replace(/\$\{method\.param\.type\}/g, Types.getSchemaType(type, json, { moduleTitle: moduleTitle, result: true, namespace: !config.copySchemasIntoModules }))
    ).join(', ')
  }
  // everything else is just output as-is
  else {

    const template = getTemplate('/parameters/result', templates)
    const type = Types.getSchemaType(result, json, { moduleTitle: moduleTitle, result: true, namespace: !config.copySchemasIntoModules })
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
    .replace(/\$\{type\}/g, Types.getSchemaType(schema, module, { templateDir: state.typeTemplateDir, code: false, namespace: !config.copySchemasIntoModules }))
    .replace(/\$\{type.link\}/g, getLinkForSchema(schema, module))
    .replace(/\$\{description\}/g, schema.description || '')
    .replace(/\$\{name\}/g, title || '')
}

function insertParameterMacros(template, param, method, module) {

  //| `${method.param.name}` | ${method.param.type} | ${method.param.required} | ${method.param.summary} ${method.param.constraints} |

  let constraints = getSchemaConstraints(param, module)
  let type = Types.getSchemaType(param.schema, module, { templateDir: state.typeTemplateDir, code: false, link: false, asPath: false, expandEnums: false, namespace: !config.copySchemasIntoModules }) //baseUrl: options.baseUrl
  // let typeLink = getLinkForSchema(param.schema, module)
  let jsonType = Types.getSchemaType(param.schema, module, { templateDir: 'json-types', code: false, link: false, asPath: false, expandEnums: false, namespace: !config.copySchemasIntoModules })

  if (constraints && type) {
    constraints = '<br/>' + constraints
  }

  template = template
    .replace(/\$\{method.param.name\}/g, param.name)
    .replace(/\$\{method.param.Name\}/g, param.name[0].toUpperCase() + param.name.substring(1))
    .replace(/\$\{method.param.summary\}/g, param.summary || '')
    .replace(/\$\{method.param.required\}/g, param.required || 'false')
    .replace(/\$\{method.param.type\}/g, type)
    .replace(/\$\{json.param.type\}/g, jsonType)
    .replace(/\$\{method.param.link\}/g, getLinkForSchema(param.schema, module)) //getType(param))
    .replace(/\$\{method.param.constraints\}/g, constraints) //getType(param))

  return template
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

function generateXUsesInterfaces(json, templates) {
  let template = ''
  if (hasAllowFocusMethods(json)) {
    template = getTemplate('/sections/xuses-interfaces', templates)
  }
  return template
}

function generateProviderSubscribe(platformApi, appApi, templates, bidirectional) {
  const interfaces = getInterfaces(platformApi)

  let template = getTemplate(`/sections/provider-subscribe`, templates)
  const providers = reduce((acc, capability) => {
    const template = insertProviderSubscribeMacros(getTemplate('/codeblocks/provider-subscribe', templates), capability, platformApi, appApi, templates, bidirectional)
    return acc + template
  }, '', interfaces)

  return interfaces.length ? template.replace(/\$\{providers\.list\}/g, providers) : ''
}

function generateProviderInterfaces(platformApi, appApi, templates, codeblock, directory, bidirectional) {
  const interfaces = getInterfaces(appApi || platformApi)
  
  let template = getTemplate('/sections/provider-interfaces', templates)

  const providers = reduce((acc, _interface) => {
    let providerTemplate = getTemplate('/codeblocks/provider', templates)

    const template = insertProviderInterfaceMacros(providerTemplate, _interface, platformApi, appApi, codeblock, directory, templates, bidirectional)
    return acc + template
  }, '', interfaces)

  return interfaces.length ? template.replace(/\$\{providers\.list\}/g, providers) : ''
}

function insertProviderSubscribeMacros(template, capability, platformApi = {}, appApi, templates, bidirectional) {
  const iface = getProviderInterface(capability, platformApi, bidirectional)

  template = template.replace(/\$\{subscribe\}/gms, iface.map(method => {
      return insertMethodMacros(getTemplate('/codeblocks/subscribe', templates), method, platformApi, appApi, templates)
    }).join('\n') + '\n')
  return template
}

function getProviderInterfaceName(iface, capability, moduleJson = {}) {
  const uglyName = capability.split(':').slice(-2).map(capitalize).map(x => x.split('-').map(capitalize).join('')).reverse().join('') + "Provider"
  let name = iface.length === 1 ? iface[0].name.charAt(0).toUpperCase() + iface[0].name.substr(1) + "Provider" : uglyName

  if (moduleJson.info['x-interface-names']) {
    name = moduleJson.info['x-interface-names'][capability] || name
  }
  return name
}

function getProviderXValues(method) {
  let xValues = []
  if (method.tags.find(t => t['x-error']) || method.tags.find(t => t['x-response'])) {
    method.tags.forEach(tag => {
      if (tag['x-response']) {
        xValues['x-response'] = tag['x-response']
      }
      if (tag['x-error']) {
        xValues['x-error'] = tag['x-error']
      }
    })
  }
  return xValues
}

function insertProviderXValues(template, document, xValues) {
  if (xValues['x-response']) {
    const xResponseInst = Types.getSchemaShape(xValues['x-response'], document, { templateDir: 'parameter-serialization', property: 'result', required: true, primitive: true, skipTitleOnce: true, namespace: !config.copySchemasIntoModules })
    template = template.replace(/\$\{provider\.xresponse\.serialization\}/gms, xResponseInst)
      .replace(/\$\{provider\.xresponse\.name\}/gms, xValues['x-response'].title)
  }
  if (xValues['x-error']) {
    const xErrorInst = Types.getSchemaShape(xValues['x-error'], document, { templateDir: 'parameter-serialization', property: 'result', required: true, primitive: true, skipTitleOnce: true, namespace: !config.copySchemasIntoModules })
    template = template.replace(/\$\{provider\.xerror\.serialization\}/gms, xErrorInst)
      .replace(/\$\{provider\.xerror\.name\}/gms, xValues['x-error'].title)
  }
  return template
}

function replaceRefsWithSchemas(obj, platformApi, document) {
  if (Array.isArray(obj)) {
    return obj.map(item => replaceRefsWithSchemas(item, platformApi, document));
  } else if (obj && typeof obj === 'object') {
    if (obj.$ref) {
      const referencedSchema = getReferencedSchema(obj.$ref, platformApi) || getReferencedSchema(obj.$ref, document);
      if (referencedSchema) {
        // Recursively replace refs in the referenced schema
        const dereferencedSchema = replaceRefsWithSchemas(referencedSchema, platformApi, document);
        return dereferencedSchema;
      }
    }
    return Object.keys(obj).reduce((acc, key) => {
      acc[key] = replaceRefsWithSchemas(obj[key], platformApi, document);
      return acc;
    }, {});
  }
  return obj;
}

function addProviderEventToMethod(method, eventMethod, document, platformApi) {
  const docCopy = JSON.parse(JSON.stringify(document));

  // Replace any refs with the referenced schema
  const updatedEventMethod = replaceRefsWithSchemas(eventMethod, platformApi, document);

  // Push the updated event method into the document
  docCopy.methods.push(updatedEventMethod);

  return {document: docCopy, updatedEventMethod };
}

function insertProviderInterfaceMacros(template, _interface, platformApi = {}, appApi = null, codeblock='interface', directory='interfaces', templates, bidirectional) {
  let document = appApi || platformApi
  const iface = getProviderInterface(_interface, document, bidirectional)

  if (platformApi && appApi) {
    // Look for the event method that matched the provider interface
    // Will likely need to improve the providers code but wanted to do it this way for backwards compatibility for now
    for (let i = 0; i < iface.length; i++) {
      const methodName = iface[i].name.split('.')[1];
      const eventMethodName = `onRequest${capitalize(methodName)}`;
  
      const eventMethod = platformApi.methods.find(method => method.name === eventMethodName);
  
      if (eventMethod) {
        const { document: updatedDocument, updatedEventMethod } = addProviderEventToMethod(iface[i], eventMethod, document, platformApi);
        iface[i].providerEvent = updatedEventMethod;
        document = updatedDocument;
      }
    }
  }

  const capability = extension(iface[0], 'x-provides')
  let xValues
  let interfaceShape = getTemplate(`/codeblocks/${codeblock}`, templates)

  if (!appApi) {
    _interface = getUnidirectionalProviderInterfaceName(_interface, capability, platformApi)
  }
  interfaceShape = interfaceShape.replace(/\$\{name\}/g, _interface)
    .replace(/\$\{capability\}/g, capability)
    .replace(/[ \t]*\$\{methods\}[ \t]*\n/g, iface.map(method => {
      const focusable = method.tags.find(t => t['x-allow-focus'])
      const interfaceTemplate = `/${directory}/` + (focusable ? 'focusable' : 'default')
      const interfaceDeclaration = getTemplate(interfaceTemplate, templates)
      xValues = getProviderXValues(method)
      method.tags.unshift({
        name: 'provider'
      })

//      let type = config.templateExtensionMap && config.templateExtensionMap['methods'] && config.templateExtensionMap['methods'].includes(suffix) ? 'methods' : 'declarations'
      return insertMethodMacros(interfaceDeclaration, method, document, null, templates, 'methods')
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
        let methodBlock = insertMethodMacros(getTemplateForMethod(method, templates), method, platformApi, appApi, templates)

        // uni-directional providers have all params composed into an object, these macros output them
        if (!appApi) {
          const parametersSchema = method.params[0].schema
          const parametersShape = Types.getSchemaShape(parametersSchema, document, { templateDir: state.typeTemplateDir, namespace: !config.copySchemasIntoModules })
          methodBlock = methodBlock.replace(/\${parameters\.shape\}/g, parametersShape)            

          const hasProviderParameters = parametersSchema && parametersSchema.properties && Object.keys(parametersSchema.properties).length > 0
          if (hasProviderParameters) {
            const lines = methodBlock.split('\n')
            for (let i = lines.length - 1; i >= 0; i--) {
              if (lines[i].match(/\$\{provider\.param\.[a-zA-Z]+\}/)) {
                let line = lines[i]
                lines.splice(i, 1)
                line = insertProviderParameterMacros(line, method.params[0].schema, document)
                lines.splice(i++, 0, line)
              }
            }
            methodBlock = lines.join('\n')
          }
          else {
            methodBlock = methodBlock.replace(/\$\{if\.provider\.params\}.*?\$\{end\.if\.provider\.params\}/gms, '')
          }
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
          .replace(/^([ \t]+)(.*?)\$\{provider\.interface\.example\.parameters\}/gm, '$1$2' + indent(JSON.stringify(method.examples[0].params[0]?.value || '', null, '    '), '$1'))
          // okay now just do the basic replacement (a single regex for both was not fun)
          .replace(/\$\{provider\.interface\.example\.result\}/g, JSON.stringify(method.examples[0].result.value))
          .replace(/\$\{provider\.interface\.example\.parameters\}/g, JSON.stringify(method.examples[0].params[0]?.value || ''))

          .replace(/\$\{provider\.interface\.example\.correlationId\}/g, JSON.stringify(method.examples[0].params[1]?.value.correlationId || ''))

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

  template = template.replace(/\$\{provider\}/g, _interface)
  template = template.replace(/\$\{interface\}/g, interfaceShape)
  template = template.replace(/\$\{capability\}/g, capability)
  template = insertProviderXValues(template, document, xValues)

  return template
}

function insertProviderParameterMacros(data = '', parameters, module = {}, options = {}) {

  if (!parameters || !parameters.properties) {
    return ''
  }

  let result = ''

  Object.entries(parameters.properties).forEach(([name, param]) => {
    let constraints = getSchemaConstraints(param, module)
    let type = Types.getSchemaType(param, module, { templateDir: state.typeTemplateDir, code: true, link: true, asPath: options.asPath, baseUrl: options.baseUrl, namespace: !config.copySchemasIntoModules })

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
  setConfig
}
