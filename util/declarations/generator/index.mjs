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

import { getMethods, getTypes, isEventMethod, isPublicEventMethod, getEnums } from '../../shared/modules.mjs'
import { getSchemaType, getSchemaShape, getMethodSignature, generateEnum } from '../../shared/typescript.mjs'
import { getExternalSchemas } from '../../shared/json-schema.mjs'

const aggregateMacros = {
  exports: '',
  mockImports: '',
  mockObjects: ''
}

// util for visually debugging crocks ADTs
const inspector = obj => {
  if (obj.inspect) {
    console.log(obj.inspect())
  } else {
    console.log(obj)
  }
}

const getModuleName = getPathOr('missing', ['info', 'title'])

const generateDeclarations = obj => {
  const code = []
  const namespace = getModuleName(obj)


  code.push(`export module ${namespace} {`)
  code.push(generateTypes(obj))
  code.push(generateExternalTypes(obj))
  code.push(generateEvents(obj))
  code.push(generateEnums(obj))
  code.push(generateMethodsWithListeners(obj))
  code.push(`}`)

  return code.join('\n')
}

const generateTypes = json => compose(
  reduce((acc, val, i, arr) => {
    const shape = getSchemaShape(json, val[1], val[0])

    // ignore empty types, e.g. `type foo;` (but not `type foo = {}`)
    if (!shape.match(/type [a-zA-Z]+;/)) {
      acc += shape + '\n'
    }

    return acc
  }, ''),
  filter(x => !x[1].enum),
  getTypes
)(json)

const generateExternalTypes = json => {
  return Object.entries(getExternalSchemas(json)).reduce((acc, val, i, arr) => {
    const shape = getSchemaShape(json, val[1], val[0].split('/').pop())
    
    if (!shape.match(/type [a-zA-Z]+;/)) {
      acc += shape + '\n'
    }

    return acc
  }, '')
}

const generateEnums = (json) => compose(
  reduce((acc, val, i, arr) => {
    acc += generateEnum(val[1])
    return acc
  }, ''),
  getEnums
)(json)

const generateEvents = (json) => compose(
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
)(json)

const generateListeners = (json) => compose(
  reduce ((acc, val, i, arr) => {
    if (i === 0) {
      acc += `
  /**
  * Listen to all ${getModuleName(json)} events.
  * @param {Function} listener The listener function to handle the events.
  */
  function listen(listener: (event: string, data: object) => {})

  /**
  * Listen to one and only one instance of any ${getModuleName(json)} event (whichever is first).
  * @param {Function} listener The listener function to handle the events.
  */
  function once(listener: (event: string, data: object) => {})     
`
  }

  const result = JSON.parse(JSON.stringify(val.result))
  result.schema = (result.schema.oneOf || result.schema.anyOf || [result.schema]).find(s => s.title !== 'ListenResponse' && s['$ref'] !== 'https://meta.comcast.com/firebolt/types#/definitions/ListenResponse')

  acc += `
  /**
   * Listen to a specific ${getModuleName(json)} event.
   * @param {Event} event The Event to listen to.
   * @param {Function} listener The listener function to handle the event.
   */
  function listen(event: '${val.name[2].toLowerCase() + val.name.substr(3)}', listener: (data: ${getSchemaType(json, result, {title: true})}) => {})

  /**
   * Listen to one and only one instance of a specific ${getModuleName(json)} event.
   * @param {Event} event The Event to listen to.
   * @param {Function} listener The listener function to handle the event.
   */
  function once(event: '${val.name[2].toLowerCase() + val.name.substr(3)}', listener: (data: ${getSchemaType(json, result, {title: true})}) => {})

`
    return acc
  }, ''),
  filter(isEventMethod),
  getMethods
)(json)

const generateMethods = json => compose(
  reduce((acc, val, i, arr) => {
    if (val.summary) {
      acc += `/**
 * ${val.summary}`
    }

    const deprecated = val.tags && val.tags.find(t => t.name === 'deprecated')
    
    if (deprecated) {
      acc += `
 *
 * @deprecated` + (deprecated['x-since'] ? ` since version ${deprecated['x-since']}` : '') + '.'
    }

    if (val.params && val.params.length) {
      acc += `
 *`
      val.params.forEach(p => acc += `
 * @param {${getSchemaType(json, p.schema)}} ${p.name} ${p.summary}`)
    }

      acc += `
 */
`
    acc += getMethodSignature(json, val, { isInterface: false }) + '\n'
    
    return acc
  }, ''),
  filter(not(isEventMethod)),
  getMethods
)(json)

const generateMethodsWithListeners = json => generateMethods(json) + '\n' + generateListeners(json)

export {
  generateDeclarations
}