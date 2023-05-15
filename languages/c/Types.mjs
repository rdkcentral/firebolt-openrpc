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

import deepmerge from 'deepmerge'
import { getPath } from '../../src/shared/json-schema.mjs'
import { getTypeName, getModuleName, description, getObjectHandleManagement, getNativeType, getPropertyAccessors, capitalize, isOptional, generateEnum, getMapAccessors, getArrayAccessors } from './src/types/NativeHelpers.mjs'
import { getArrayAccessorsImpl, getMapAccessorsImpl, getObjectHandleManagementImpl, getPropertyAccessorsImpl } from './src/types/ImplHelpers.mjs'
import { getJsonContainerDefinition, getJsonDataStructName } from './src/types/JSONHelpers.mjs'

const getSdkNameSpace = () => 'FireboltSDK'
const getJsonNativeTypeForOpaqueString = () => getSdkNameSpace() + '::JSON::String'
const getEnumName = (name, prefix) => ((prefix.length > 0) ? (prefix + '_' + name) : name)

const hasProperties = (prop) => {
  let hasProperty = false
  if (prop.properties) {
     hasProperty = true
  } else if (prop.additionalProperties && ( prop.additionalProperties.type && (((prop.additionalProperties.type === 'object') && prop.additionalProperties.properties) || (prop.additionalProperties.type !== 'object')))) {
     hasProperty = true
  }
  return hasProperty
}

function validJsonObjectProperties(json = {}) {

  let valid = true
  if (json.type === 'object' || (json.additonalProperties && typeof json.additonalProperties.type === 'object')) {
    if (json.properties || json.additonalProperties) {
      Object.entries(json.properties || json.additonalProperties).every(([pname, prop]) => {
        if (!prop['$ref'] && (pname !== 'additionalProperties') &&
           ((!prop.type && !prop.const && (prop.schema && !prop.schema.type)) || (Array.isArray(prop.type) && (prop.type.find(t => t === 'null'))))) {
          valid = false
        }
        return valid
      })
    }
  }
  return valid
}

const deepMergeAll = (module, name, schema, schemas, options) => {
  let nonRefsProperty = [...schema.allOf.map(x => x['$ref'] ? '' : x)].filter(elm => elm)
  let refsProperty = [...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module, schemas) : '')].filter(elm => elm)
  let mergedProperty = []
  let mergedParamSchema = {
    type: "object",
    properties: {}
  }

  nonRefsProperty.forEach(p => {
    if (p.properties) {
      Object.entries(p.properties).every(([pname, prop]) => {
        let present = false
        refsProperty.forEach(refP => {
          if (refP.properties) {
            Object.entries(refP.properties).every(([refname, refprop]) => {
              if (refname == pname) {
                present = true
              }
              return !present
            })
          }
        })
        let prefixedName = (present == false) ? (name + capitalize(pname)) : pname
        mergedParamSchema.properties[prefixedName] = prop
        return true
      })
      mergedProperty.push(mergedParamSchema)
    }
  })
  refsProperty.forEach(ref => mergedProperty.push(ref))
  let union = deepmerge.all(mergedProperty)

  return union
}

function getMethodSignature(method, module, { destination, isInterface = false }) {
  const extraParam = '${method.result.type}* ${method.result.name}'

  const prefix = method.tags.find(t => t.name.split(":")[0] === "property") ? "Get" : ""

  return 'uint32_t ${info.title}_' + prefix + '${method.Name}(' + extraParam + ')'
}

function getMethodSignatureParams(method, module, { destination }) {
  return method.params.map(param => param.name + (!param.required ? '?' : '') + ': ' + getSchemaType(param.schema, module, { name: method.result.name, title: true, destination })).join(', ')
}

const safeName = prop => prop.match(/[.+]/) ? '"' + prop + '"' : prop

function getSchemaType(schema, module, { name, destination, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {
  let info = getSchemaTypeInfo(module, schema, name, module['x-schemas'], { title: title })
  return info.type
}

function getSchemaTypeInfo(module = {}, json = {}, name = '', schemas = {}, prefixName = '', options = {level: 0, descriptions: true, title: false}) {

  if (json.schema) {
    json = json.schema
  }

  let structure = {}
  structure["type"] = ''
  structure["json"] = []
  structure["name"] = {}
  structure["namespace"] = {}

  if (json['$ref']) {
    if (json['$ref'][0] === '#') {
      //Ref points to local schema
      //Get Path to ref in this module and getSchemaType
      let definition = getPath(json['$ref'], module, schemas)
      let tName = definition.title || json['$ref'].split('/').pop()
      const res = getSchemaTypeInfo(module, definition, tName, schemas, '', options)
      structure.type = res.type
      structure.json = res.json
      structure.name = res.name
      structure.namespace = res.namespace
      return structure
    }
  }
  else if (json.const) {
    structure.type = getNativeType(json)
    structure.json = json
    return structure
  }
  else if (json['x-method']) {
    console.log(`WARNING UNHANDLED: x-method in ${name}`)
    return structure
    //throw "x-methods not supported yet"
  }
  else if (json.type === 'string' && json.enum) {
    //Enum
    structure.name = capitalize(name || json.title)
    let typeName = getTypeName(getModuleName(module), name || json.title, prefixName, false, false)
    let res = description(capitalize(name || json.title), json.description) + '\n' + generateEnum(json, typeName)
    structure.json = json
    structure.type = typeName
    structure.namespace = getModuleName(module)
    return structure
  }
  else if (Array.isArray(json.type)) {
    let type = json.type.find(t => t !== 'null')
    console.log(`WARNING UNHANDLED: type is an array containing ${json.type}`)
  }
  else if (json.type === 'array' && json.items && (validJsonObjectProperties(json) === true)) {
    let res
    if (Array.isArray(json.items)) {
            //TODO
      const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
      if (!IsHomogenous(json.items)) {
        throw 'Heterogenous Arrays not supported yet'
      }
      res = getSchemaTypeInfo(module, json.items[0], json.items[0].name || name, schemas, prefixName)
    }
    else {
      // grab the type for the non-array schema
      res = getSchemaTypeInfo(module, json.items, json.items.name || name, schemas, prefixName)
    }

    let arrayName = capitalize(res.name) + capitalize(res.json.type)
    let n = getTypeName(getModuleName(module), arrayName, prefixName)
    let def = description(arrayName, json.description) + '\n'
    if (options.level === 0) {
      def += getObjectHandleManagement(n + 'Array') + '\n'
    }

    def += getArrayAccessors(getModuleName(module), arrayName, (n + 'Array'), res.type)
    structure.name = res.name || name && (capitalize(name))
    structure.type = n + 'ArrayHandle'
    structure.json = json
    structure.namespace = getModuleName(module)
    return structure
  }
  else if (json.allOf) {
    let title = json.title ? json.title : name
    let union = deepMergeAll(module, title, json, schemas, options)
    union['title'] = title

    delete union['$ref']
    return getSchemaTypeInfo(module, union, '', schemas, '', options)
  }
  else if (json.oneOf) {
    structure.type = 'char*'
    structure.json.type = 'string'
    return structure
  }
  else if (json.anyOf) {
    //let mergedSchema = getMergedSchema(module, json, name, schemas)
    //let prefix = ((prefixName.length > 0) && (name != prefixName)) ? prefixName : capitalize(name)
    //return getSchemaTypeInfo(module, mergedSchema, '', schemas, prefix, options)
  }
  else if (json.type === 'object') {
    structure.json = json
    if (hasProperties(json)) {
      structure.type = getTypeName(getModuleName(module), json.title || name, prefixName) + 'Handle'
      structure.name = (json.name ? json.name : (json.title ? json.title : name))
      structure.namespace = (json.namespace ? json.namespace : getModuleName(module))
    }
    else {
      structure.type = 'char*'
    }
    if (name) {
      structure.name = capitalize(name)
    }

    return structure
  }
  else if (json.type) {
    structure.type = getNativeType(json)
    structure.json = json
    if (name || json.title) {
      structure.name = capitalize(name || json.title)
    }
    structure.namespace = getModuleName(module)

    return structure
  }
  return structure
}

function getSchemaShape(json, module, { name = '', level = 0, title, summary, descriptions = true, destination = '', section = '', enums = true } = {}) {
    return getSchemaShapeInfo(json, module, module['x-schemas'], '', { name, level, title, summary, descriptions, destination, section, enums })
}
function getSchemaShapeInfo(json, module, schemas = {}, prefixName = '', { name = '', level = 0, title, summary, descriptions = true, destination = '', section = '', enums = true } = {}) {
  const isHeader = (destination.includes("JsonData_") !== true) && destination.endsWith(".h")
  const isCPP = ((destination.endsWith(".cpp") || destination.includes("JsonData_")) && section !== 'accessors')
  json = JSON.parse(JSON.stringify(json))

  name = json.title || name
  let shape = ''

  if (json['$ref']) {
    if (json['$ref'][0] === '#') {
      //Ref points to local schema
      //Get Path to ref in this module and getSchemaType
      const schema = getPath(json['$ref'], module, schemas)
      const tname = schema.title || json['$ref'].split('/').pop()
      shape = getSchemaShapeInfo(schema, module, schemas, prefixName, { name, level, title, summary, descriptions, destination, section, enums })
    }
  }
  //If the schema is a const,
  else if (json.hasOwnProperty('const') && !isCPP) {
    if (level > 0) {

      let t = description(name, json.description)
      typeName = getTypeName(getModuleName(module), name, prefixName)
      t += (isHeader ? getPropertyAccessors(typeName, capitalize(name), typeof schema.const, { level: level, readonly: true, optional: false }) : getPropertyAccessorsImpl(typeName, getJsonType(schema, module, { level, name }), typeof schema.const, { level: level, readonly: true, optional: false }))
            shape += '\n' + t
    }
  }
  else if (json.type === 'object') {
    if (!name) {
      console.log(`WARNING: unnamed schema in ${module.info.title}.`)
      console.dir(json)
      shape = ''
    }
    else if (json.properties && (validJsonObjectProperties(json) === true)) {
      let c_shape = description(name, json.description)
      let cpp_shape = ''
      let tName = getTypeName(getModuleName(module), name, prefixName)
      c_shape += '\n' + (isHeader ? getObjectHandleManagement(tName) : getObjectHandleManagementImpl(tName, getJsonType(json, module, { name })))
      Object.entries(json.properties).forEach(([pname, prop]) => {
        let res
        var desc = '\n' + description(pname, prop.description)
        if (prop.type === 'array') {
          if (Array.isArray(prop.items)) {
            //TODO
            const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
            if (!IsHomogenous(prop.items)) {
              throw 'Heterogenous Arrays not supported yet'
            }
            res = getSchemaTypeInfo(module, prop.items[0], pname, schemas, prefixName, options)
          }
          else {
            // grab the type for the non-array schema
            res = getSchemaTypeInfo(module, prop.items, pname, schemas, prefixName, {level : level, descriptions: descriptions, title: true})
          }
          if (res.type && res.type.length > 0) {
            let n = tName + '_' + (pname || prop.title)
            let def = (isHeader ? getArrayAccessors(n + 'Array', res) : getArrayAccessorsImpl(tName, pname, res, { readonly: true, optional: false }))
            c_shape += '\n' + def
          }
          else {
            console.log(`a. WARNING: Type undetermined for ${name}:${pname}`)
          }
        } else {
          let info = getSchemaTypeInfo(module, prop, pname, module['x-schemas'], prefixName, {descriptions: descriptions, level: level + 1, title: true})
          if (info.type && info.type.length > 0) {
            let subPropertyName = ((pname.length !== 0) ? capitalize(pname) : info.name)
            let moduleProperty = getJsonTypeInfo(module, json, name, schemas, prefixName)
            let subProperty = getJsonTypeInfo(module, prop, pname, schemas, prefixName)
            c_shape += '\n' + description(pname, info.json.description)
            c_shape += '\n' + (isHeader ? getPropertyAccessors(tName, capitalize(pname), info.type, { level: level, readonly: false, optional: isOptional(pname, json) }) : getPropertyAccessorsImpl(tName, moduleProperty.type, subProperty.type, subPropertyName, info.type, info.json, {readonly:false, optional:isOptional(pname, json)}))
          }
          else {
            console.log(`b. WARNING: Type undetermined for ${name}:${pname}`)
          }
        }
      })
      cpp_shape += getJsonContainerDefinition(json, name, Object.entries(json.properties).map(([name, prop]) => ({ name, type: getJsonType(prop, module, { name }) })))

      if (isCPP) {
        shape += '\n' + cpp_shape
      }
      else {
        shape += '\n' + c_shape
      }
    }
    else if (json.propertyNames && json.propertyNames.enum) {
      //propertyNames in object not handled yet
    }
    else if (json.additionalProperties && (typeof json.additionalProperties === 'object') && (validJsonObjectProperties(json) === true) && !isCPP) {
      let info = getSchemaTypeInfo(module, json.additionalProperties, name, module['x-schemas'])
      if (!info.type || (info.type.length === 0)) {
        info.type = 'char*'
        info.json = schema.additionalProperties
        info.json.type = 'string'
      }
      let tName = getTypeName(getModuleName(module), name)
      let t = description(name, json.description) + '\n'
      let containerType = 'WPEFramework::Core::JSON::VariantContainer'

      let subModuleProperty = getJsonTypeInfo(module, info.json, info.name, module['x-schemas'])
      if (isCPP && ((info.json.type === 'object' && info.json.properties) || info.json.type === 'array')) {
        // Handle Container generation here
      }
      t += '\n' + (isHeader ? getObjectHandleManagement(tName) : getObjectHandleManagementImpl(tName, containerType))
      t += (isHeader ? getMapAccessors(tName, info.type, { descriptions: descriptions, level: level }) : getMapAccessorsImpl(tName, containerType, subModuleProperty.type, info.type, info.json, { readonly: true, optional: false }))
      shape += '\n' + t
    }
    else if (json.patternProperties) {
      console.log(`WARNING: patternProperties are not supported by Firebolt(inside getModuleName(moduleJson):${name})`)
    }
  }
  else if (json.anyOf) {
    //let mergedSchema = getMergedSchema(module, json, name, schemas)
    //let prefix = ((prefixName.length > 0) && (name != prefixName)) ? prefixName : capitalize(name)
    //return getSchemaShapeInfo(moduleJson, mergedSchema, schemas, name, prefix, { name, level, title, summary, descriptions, destination, section, enums })
  }
  else if (json.oneOf) {
    //Just ignore schema shape, since this has to be treated as string
  }
  else if (json.allOf) {
    let title = (json.title ? json.title : name)
    let union = deepMergeAll(module, title, json, schemas)
    union.title = title

    delete union['$ref']
    return getSchemaShapeInfo(union, module, schemas, prefixName, { name, level, title, summary, descriptions, destination, section, enums })
  }
  else if (json.type === 'array') {
    shape += '\n' + getSchemaType(module, json, name, schemas, prefixName, {level: 0, descriptions: descriptions})
  }
  else {
    shape += '\n' + getSchemaType(module, json, name, schemas, prefixName, {level: level, descriptions: descriptions})
  }

  return shape
}

const getJsonNativeType = json => {
  let type
  let jsonType = json.const ? typeof json.const : json.type

  if (jsonType === 'string') {
    type = getSdkNameSpace() + '::JSON::String'
  }
  else if (jsonType === 'number') {
    type = 'WPEFramework::Core::JSON::Float'
  }
  else if (json.type === 'integer') {
    type = 'WPEFramework::Core::JSON::DecSInt32'
  }
  else if (jsonType === 'boolean') {
    type = 'WPEFramework::Core::JSON::Boolean'
  }
  else {
    throw 'Unknown JSON Native Type !!!'
  }
  return type
}

function getJsonType(schema = {}, module = {}, { name = '', descriptions = false, level = 0 } = {}) {
  let info = getJsonTypeInfo(module, schema, name, module['x-schemas'], '', { descriptions: descriptions, level: level })
  return info.type
}

function getJsonTypeInfo(module = {}, json = {}, name = '', schemas, prefixName = '', {descriptions = false, level = 0} = {}) {

  if (json.schema) {
    json = json.schema
  }

  let structure = {}
  structure["deps"] = new Set() //To avoid duplication of local ref definitions
  structure["type"] = []

  if (json['$ref']) {
    if (json['$ref'][0] === '#') {
      //Ref points to local schema
      //Get Path to ref in this module and getSchemaType
      let definition = getPath(json['$ref'], module, schemas)
      let tName = definition.title || json['$ref'].split('/').pop()

      const res = getJsonTypeInfo(module, definition, tName, schemas, '', {descriptions: descriptions, level: level})
      structure.deps = res.deps
      structure.type = res.type
      return structure
    }
  }
  else if (json.const) {
    structure.type = getJsonNativeType(json)
    return structure
  }
  else if (json['x-method']) {
    return structure
    //throw "x-methods not supported yet"
  }
  else if (json.additionalProperties && (typeof json.additionalProperties === 'object')) {
      //This is a map of string to type in schema
      //Get the Type
      let type = getJsonTypeInfo(module, json.additionalProperties, name, schemas, prefixName)
      if (type.type && type.type.length > 0) {
          structure.type = 'WPEFramework::Core::JSON::VariantContainer';
          return structure
      }
      else {
        console.log(`WARNING: Type undetermined for ${name}`)
      }
    }
  else if (json.type === 'string' && json.enum) {
    //Enum
    let t = 'WPEFramework::Core::JSON::EnumType<' + (json.namespace ? json.namespace : getModuleName(module)) + '_' + (getEnumName(name, prefixName)) + '>'
    structure.type.push(t)
    return structure
  }
  else if (Array.isArray(json.type)) {
    let type = json.type.find(t => t !== 'null')
    console.log(`WARNING UNHANDLED: type is an array containing ${json.type}`)
  }
  else if (json.type === 'array' && json.items) {
    let res
    let items
    if (Array.isArray(json.items)) {
      //TODO
      const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
      if (!IsHomogenous(json.items)) {
        throw 'Heterogenous Arrays not supported yet'
      }
      items = json.items[0]
    }
    else {
      items = json.items
      // grab the type for the non-array schema
    }
    res = getJsonTypeInfo(module, items, items.name || name, schemas, prefixName)
    structure.deps = res.deps
    let n = capitalize(name || json.title)
    structure.type.push(`WPEFramework::Core::JSON::ArrayType<${res.type}>`)

    return structure
  }
  else if (json.allOf) {
    let title = json.title ? json.title : name
    let union = deepMergeAll(module, title, json, schemas)
    union['title'] = title

    delete union['$ref']
    return getJsonTypeInfo(module, union, '', schemas, '', options)
  }
  else if (json.oneOf) {
    structure.type = getJsonNativeTypeForOpaqueString()
    return structure
  }
  else if (json.patternProperties) {
    structure.type = getJsonNativeTypeForOpaqueString()
    return structure
  }
  else if (json.anyOf) {
    /*let mergedSchema = getMergedSchema(module, json, name, schemas)
    return getJsonTypeInfo(module, mergedSchema, name, schemas, prefixName, options)*/
  }
  else if (json.type === 'object') {
    if (hasProperties(json) !== true) {
      structure.type = getJsonNativeTypeForOpaqueString()
    }
    else {
      let schema = getSchemaTypeInfo(module, json, name)
      if (schema.namespace && schema.namespace.length > 0) {
        structure.type.push(getJsonDataStructName(schema.namespace, json.title || name, prefixName))
      }
    }
    return structure
  }
  else if (json.type) {
    structure.type = getJsonNativeType(json)
    return structure
  }
  return structure
}

function getTypeScriptType(jsonType) {
  if (jsonType === 'integer') {
    return 'number'
  }
  else {
    return jsonType
  }
}

const enumReducer = (acc, val, i, arr) => {
  const keyName = val.split(':').pop().replace(/[\.\-]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()
  acc = acc + `    ${keyName} = '${val}'`
  if (i < arr.length - 1) {
    acc = acc.concat(',\n')
  }
  return acc
}

export default {
    getMethodSignature,
    getMethodSignatureParams,
    getSchemaShape,
    getSchemaType,
    getJsonType
}
