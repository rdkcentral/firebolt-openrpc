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
import pointfree from 'crocks/pointfree/index.js'
const { filter, reduce } = pointfree
import logic from 'crocks/logic/index.js'
const { not } = logic

import { getMethods, getTypes, isEventMethod, isPublicEventMethod, isPolymorphicPullMethod, getEnums, isRPCOnlyMethod, getProvidedCapabilities, isTemporalSetMethod, getPayloadFromEvent } from '../../shared/modules.mjs'
import { getSchemaType, getSchemaShape, getMethodSignature, getMethodSignatureParams, generateEnum, getProviderInterface, getProviderName, getProviderSessionInterface } from '../../shared/typescript.mjs'
import { getExternalSchemas } from '../../shared/json-schema.mjs'

const getModuleName = getPathOr('missing', ['info', 'title'])

const generateMacros = (obj = {}, templates = {}) => {
  const code = []
  const namespace = getModuleName(obj)

  code.push(`export module ${namespace} {`)
  code.push(generateTypes(obj, templates))
  code.push(generateExternalTypes(obj, templates))
  code.push(generateEvents(obj))
  code.push(generateEnums(obj))
  code.push(generateMethodsWithListeners(obj, templates))
  code.push(generateSDKInterfaces(obj))
  code.push(generateProviders(obj, templates))
  code.push(`}`)

  return { declarations: code.join('\n') }
}

const insertMacros = (content, macros) => {
    return content.replace(/[ \t]*\/\* \$\{DECLARATIONS\} \*\/[ \t]*\n/, macros.declarations)
}

const generateAggregateMacros = (modules, templates) => {
    const typescript = modules  .map(module => generateMacros(module, templates))
                                .map(macros => macros.declarations)
                                .join('\n')

    return {
        declarations: typescript
    }
}

const insertAggregateMacros = (content, macros) => {
    return content.replace(/[ \t]*\/\* \$\{DECLARATIONS\} \*\/[ \t]*\n/g, macros.declarations)
}

const generateSDKInterfaces = json => {
  return getProviderSessionInterface(json)
}

const generateTypes = (json) => compose(
  reduce((acc, val) => {
    const shape = getSchemaShape(json, val[1], null, val[0])

    // ignore empty types, e.g. `type foo;` (but not `type foo = {}`)
    if (!shape.match(/type [a-zA-Z]+;/)) {
      acc += shape + '\n'
    }

    return acc
  }, ''),
  filter(x => !x[1].enum),
  getTypes
)(json)

const generateExternalTypes = (json) => {
  return Object.entries(getExternalSchemas(json)).reduce((acc, val, i, arr) => {
    const shape = getSchemaShape(json, val[1], null, val[0].split('/').pop())
    
    if (!shape.match(/type [a-zA-Z]+;/)) {
      acc += shape + '\n'
    }

    return acc
  }, '')
}

const generateEnums = compose(
  reduce((acc, val, i, arr) => {
    acc += generateEnum(val[1])
    return acc
  }, ''),
  getEnums
)

const deprecatedMessage = (val) => {
  const deprecated = val.tags && val.tags.find(t => t.name === 'deprecated')
    
  if (deprecated) {
    return `
*
* @deprecated` + (deprecated['x-since'] ? ` since version ${deprecated['x-since']}` : '') + '.'
  }

  return ''
}

const generateEvents = compose(
  reduce((acc, val, i, arr) => {
    if (i === 0) {
      acc += 'type Event = '
    }

    acc += `'${val.name[2].toLowerCase() + val.name.substr(3)}'`
    if (i < arr.length-1) {
      acc += ' | '
    }

    return acc
  }, ''),
  filter(isPublicEventMethod),
  getMethods
)

const generateListeners = (json) => compose(
  reduce ((acc, val, i, arr) => {
    if (i === 0) {
      acc += `
  /**
  * Listen to all ${getModuleName(json)} events.
  * @param {Function} listener The listener function to handle the events.
  */
  function listen(listener: (event: string, data: object) => void): Promise<number>

  /**
  * Listen to one and only one instance of any ${getModuleName(json)} event (whichever is first).
  * @param {Function} listener The listener function to handle the events.
  */
  function once(listener: (event: string, data: object) => void): Promise<number>
`
  }

  const result = JSON.parse(JSON.stringify(val.result))
//  result.schema = (result.schema.oneOf || result.schema.anyOf || [result.schema]).find(s => s.title !== 'ListenResponse' && s['$ref'] !== 'https://meta.comcast.com/firebolt/types#/definitions/ListenResponse')
  result.schema = getPayloadFromEvent(val, json)

  acc += `
  /**
   * Listen to a specific ${getModuleName(json)} event.
   * @param {Event} event The Event to listen to.
   * @param {Function} listener The listener function to handle the event.
   */
  function listen(event: '${val.name[2].toLowerCase() + val.name.substr(3)}', listener: (data: ${getSchemaType(json, result, null, {title: true})}) => void): Promise<number>

  /**
   * Listen to one and only one instance of a specific ${getModuleName(json)} event.
   * @param {Event} event The Event to listen to.
   * @param {Function} listener The listener function to handle the event.
   */
  function once(event: '${val.name[2].toLowerCase() + val.name.substr(3)}', listener: (data: ${getSchemaType(json, result, null, {title: true})}) => void): Promise<number>

`
  acc += `
  /**
   * Clear all ${getModuleName(json)} listeners, or just the listener for a specific Id.
   * @param {id} optional id of the listener to clear.
   */
  function clear(id?: number): boolean
`
    return acc
  }, ''),
  filter(isEventMethod),
  getMethods
)(json)

const generateProviders = (json) => compose(
  reduce ((acc, val, i, arr) => {
    const iface = getProviderInterface(json, val)
    const className = getProviderName(val, json)

    acc += `
  interface ${className} {\n`

    iface.forEach(method => {
      const parametersType = getSchemaType(json, method.params[0].schema)
      const resultType = getSchemaType(json, method.result.schema)
      const focusable = !!method.tags.find(t => t['x-allow-focus'])

      acc += `      ${method.name}(parameters: ${parametersType}, session: ${(focusable ? 'Focusable' : '')}ProviderSession):Promise<${resultType}>\n`
    })

    acc += `}\n`

    acc += `
  /**
   * Provide the '${val}' Capability
   * @param {string} capability The Capability to provide
   * @param {${className}} provider The object providing the capability interface
   */
  function provide(capability: '${val}', provider: ${className} | object): Promise<void>
`
    return acc
  }, ''),
  getProvidedCapabilities
)(json)


const polymorphicPull = (json, val) => {
  let acc = ''

  acc += `/**\n`

  if (val.summary) {
    acc += ` * ${val.summary}`
  }

  acc += deprecatedMessage(val)

  if (val.params && val.params.length) {
    acc += `
 *`
    val.params.forEach(p => acc += `
 * @param {${getSchemaType(json, p.schema)}} ${p.name} ${p.summary}`)
  }

    acc += `
 */
`

  const type = val.name[0].toUpperCase() + val.name.substr(1)

  acc += `function ${val.name}(callback: (parameters: ${type}Parameters) => Promise<${type}Result>): Promise<boolean>\n`
    
  return acc
}

const polymorphicPush = (json, val) => {
  let acc = ''

  acc += `/**\n`

  if (val.summary) {
    acc += ` * ${val.summary}`
  }

  acc += deprecatedMessage(val)

  const params = JSON.parse(JSON.stringify(val.params))
  params.pop()

  if (val.params && val.params.length) {
    acc += `
 *`
    val.params.forEach(p => acc += `
 * @param {${getSchemaType(json, p.schema)}} ${p.name} ${p.summary}`)
  }

    acc += `
 */
`

  const type = val.name[0].toUpperCase() + val.name.substr(1)

  acc += `function ${val.name}(data: ${type}Result): Promise<boolean>\n`
    
  return acc
}

const subscriber = (json, val) => {
  let acc = ''

  acc += `/**\n`

  if (val.summary) {
    acc += ` * ${val.summary}`
  }

  acc += deprecatedMessage(val)

  acc += `
 *
 * @param {Function} subscriber A subscriber callback to pass updated values to
 */
`
  const type = val.name[0].toUpperCase() + val.name.substr(1)
  const context = getMethodSignatureParams(json, val, null, { isInterface: false })

  acc += `function ${val.name}(${context ? context + ', ' : ''}subscriber: (${val.result.name}: ${getSchemaType(json, val.result.schema)}) => void): Promise<number>\n`
    
  return acc
}

const setter = (json, val) => {
  let acc = ''

  acc += `/**\n`
  
  if (val.summary) {
    acc += ` * ${val.summary}`
  }

  acc += deprecatedMessage(val)

  acc += `
 *
 * @param {${getSchemaType(json, val.result.schema)}} value The new ${val.name} value.
 */
`
  const type = val.name[0].toUpperCase() + val.name.substr(1)
  const context = getMethodSignatureParams(json, val, null, { isInterface: false })

  acc += `function ${val.name}(${context ? context + ', ' : ''}value: ${getSchemaType(json, val.result.schema)}): Promise<void>\n`
    
  return acc
}


const generateMethods = (json) => compose(
  reduce((acc, val, i, arr) => {

    acc += `/**\n`

    if (val.summary) {
      acc += ` * ${val.summary}`
    }
    
    acc += deprecatedMessage(val)

    if (val.params && val.params.length) {
      acc += `
 *`
      val.params.forEach(p => acc += `
 * @param {${getSchemaType(json, p.schema)}} ${p.name} ${p.summary}`)
    }

      acc += `
 */
`
    let sig = getMethodSignature(json, val, null, { isInterface: false })

    if (isTemporalSetMethod(val)) {
      const itemType = getSchemaType(json, val.result.schema.items)
      sig = sig.substring(0, sig.lastIndexOf(')'))
      if (val.params && val.params.length) {
        sig += ', '
      }
      sig +=  `add: (item: ${itemType}) => void, remove: (item: ${itemType}) => void): { stop: () => {} }\n` +
              sig + `add: (item: ${itemType}) => void): { stop: () => {} }`
    }

    if (val.tags && val.tags.find(t => t.name == 'polymorphic-pull')) {
      sig = polymorphicPush(json, val)
      sig += '\n' + polymorphicPull(json, val)
    }

    acc += sig + '\n'

    const needsSubscriber = val.tags && (val.tags.find(t => t.name === 'property') || val.tags.find(t => t.name === 'property:readonly')) != undefined
    const needsSetter = val.tags && val.tags.find(t => t.name === 'property') != undefined

    if (needsSubscriber) {
      acc += subscriber(json, val)
    }

    if (needsSetter) {
      acc += setter(json, val)
    }

    return acc
  }, ''),
  filter(not(isRPCOnlyMethod)),
  filter(not(isEventMethod)),
  getMethods
)(json)

const generateMethodsWithListeners = (json) => generateMethods(json) + '\n' + generateListeners(json) + '\n'

export {
    generateMacros,
    insertMacros,
    generateAggregateMacros,
    insertAggregateMacros,
}