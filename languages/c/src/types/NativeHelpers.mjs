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
import pointfree from 'crocks/pointfree/index.js'
const { chain, filter, reduce, option, map } = pointfree
import predicates from 'crocks/predicates/index.js'
import { getPath, getExternalSchemaPaths } from '../../../../src/shared/json-schema.mjs'
import deepmerge from 'deepmerge'

const { isObject, isArray, propEq, pathSatisfies, hasProp, propSatisfies } = predicates

const getModuleName = json => getPathOr(null, ['info', 'title'], json) || json.title || 'missing'

const getHeaderText = () => {

    return `/*
*  Copyright 2022 Comcast
*
*  Auto Generated using firebolt-openrpc tools. DO NOT EDIT.
*
*/

`
}
    
const getIncludeGuardOpen = (json, prefix=null) => {
  prefix = prefix ? `${prefix.toUpperCase()}_` : ''
    return `
#ifndef _${prefix}${getModuleName(json).toUpperCase()}_H
#define _${prefix}${getModuleName(json).toUpperCase()}_H

`
}
    
const getStyleGuardOpen = () => {
    return `
#ifdef __cplusplus
extern "C" {
#endif

`
}
    
const getStyleGuardClose = () => {
    return `

#ifdef __cplusplus
}
#endif

`
}
    
const getIncludeGuardClose = () => {
    return `
#endif // Header Include Guard
`
}

const capitalize = str => str[0].toUpperCase() + str.substr(1)
const description = (title, str='') => '/* ' + title + (str.length > 0 ? ' - ' + str : '') + ' */'
const isOptional = (prop, json) => (!json.required || !json.required.includes(prop))

const SdkTypesPrefix = 'Firebolt'

const Indent = '    '

const getNativeType = json => {
    let type

    if (json.const) {
      if (typeof json.const === 'string') {
        type = 'char*'
      }
      else if (typeof json.const === 'number') {
        type = 'uint32_t'
        if (json.const < 0)
            type = 'int32_t'
      } else if (typeof json.const === 'boolean'){
        type = 'bool'
      }
    }
    else if (json.type === 'string') {
        type = 'char*'
    }
    else if (json.type === 'number' || json.type === 'integer') { //Lets keep it simple for now
        type = 'uint32_t'
        if ((json.minimum && json.minimum < 0)
             || (json.exclusiveMinimum && json.exclusiveMinimum < 0)) {
            type = 'int32_t'
        }
    }
    else if (json.type === 'boolean') {
      type = 'bool'
    }
    return type
}

const getObjectHandleManagement = varName => {

    let result = `typedef void* ${varName}Handle;
${varName}Handle ${varName}Handle_Create(void);
void ${varName}Handle_Addref(${varName}Handle handle);
void ${varName}Handle_Release(${varName}Handle handle);
bool ${varName}Handle_IsValid(${varName}Handle handle);
`
    return result
}

const getPropertyAccessors = (objName, propertyName, propertyType,  options = {level:0, readonly:false, optional:false}) => {

  let result = `${Indent.repeat(options.level)}${propertyType} ${objName}_Get_${propertyName}(${objName}Handle handle);` + '\n'

  if (!options.readonly) {
    result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}Handle handle, ${propertyType} ${propertyName.toLowerCase()});` + '\n'
  }

  if (options.optional === true) {
    result += `${Indent.repeat(options.level)}bool ${objName}_has_${propertyName}(${objName}Handle handle);` + '\n'
    result += `${Indent.repeat(options.level)}void ${objName}_clear_${propertyName}(${objName}Handle handle);` + '\n'
  }

  return result
}

const getMapAccessors = (typeName, nativeType,  level=0) => {

  let res

  res = `${Indent.repeat(level)}uint32_t ${typeName}_KeysCount(${typeName}Handle handle);` + '\n'
  res += `${Indent.repeat(level)}void ${typeName}_AddKey(${typeName}Handle handle, char* key, ${nativeType} value);` + '\n'
  res += `${Indent.repeat(level)}void ${typeName}_RemoveKey(${typeName}Handle handle, char* key);` + '\n'
  res += `${Indent.repeat(level)}${nativeType} ${typeName}_FindKey(${typeName}Handle handle, char* key);` + '\n'

  return res
}

const getTypeName = (moduleName, varName, upperCase = false) => {
  let mName = upperCase ? moduleName.toUpperCase() : capitalize(moduleName)
  let vName = upperCase ? varName.toUpperCase() : capitalize(varName) 

  return `${mName}_${vName}`
}

const getArrayAccessors = (arrayName, valueType) => {

  let res = `uint32_t ${arrayName}_Size(${arrayName}Handle handle);` + '\n'
  res += `${valueType} ${arrayName}_Get(${arrayName}Handle handle, uint32_t index);` + '\n'
  res += `void ${arrayName}_Add(${arrayName}Handle handle, ${valueType} value);` + '\n'
  res += `void ${arrayName}_Clear(${arrayName}Handle handle);` + '\n'

  return res
}

const enumValue = (val,prefix) => {
  const keyName = val.replace(/[\.\-:]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase()
  return `    ${prefix.toUpperCase()}_${keyName.toUpperCase()}`
}

const generateEnum = (schema, prefix)=> {
  if (!schema.enum) {
    return ''
  }
  else {
    let str = `typedef enum {\n`
    str += schema.enum.map(e => enumValue(e, prefix)).join(',\n')
    str += `\n} ${prefix};\n`
    return str
  }
}

const getIncludeDefinitions = (json = {}, jsonData = false) => {
  return getExternalSchemaPaths(json)
    .map(ref => {
      const mod = ref.split('#')[0].split('/').pop()
      let i = `#include "Common/${capitalize(mod)}.h"`
      if(jsonData === true) {
        i += '\n' + `#include "JsonData_${capitalize(mod)}.h"`
      }
      return i
    })
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .concat([`#include "Firebolt/Types.h"`])
}

function getSchemaType(module = {}, json = {}, name = '', schemas = {}, options = {level: 0, descriptions: true, title: false}) {
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
      const res = getSchemaType(module, definition, tName, schemas, {descriptions: options.descriptions, level: options.level})
      res.deps.forEach(dep => structure.deps.add(dep))
      structure.type = res.type
      return structure
    }
    else {
      // External dependency.
      // e.g, "https://meta.comcast.com/firebolt/entertainment#/definitions/ProgramType"

      //Get the module of this definition
      const schema = getPath(json['$ref'].split('#')[0], schemas) || module

      //Get the schema of the definition
      const definition = getPath(json['$ref'], module, schemas)
      let tName = definition.title || json['$ref'].split('/').pop()
      const res = getSchemaType(schema, definition, tName, schemas, {descriptions: options.descriptions, level: options.level})
      //We are only interested in the type definition for external modules
      structure.type = res.type
      return structure
    }
  }
  else if (json.const) {
    structure.type = getNativeType(json)
    return structure
  }
  else if (json['x-method']) {
    console.log(`WARNING UNHANDLED: x-method in ${name}`)
    return structure
    //throw "x-methods not supported yet"
  }
  else if (json.type === 'string' && json.enum) {
    //Enum
    let typeName = getTypeName(getModuleName(module), name || json.title) 
    let res = description(capitalize(name || json.title), json.description) + '\n' + generateEnum(json, typeName)
    structure.deps.add(res)
    structure.type.push(typeName)
    return structure
  }
  else if (Array.isArray(json.type)) {
    let type = json.type.find(t => t !== 'null')
    console.log(`WARNING UNHANDLED: type is an array containing ${json.type}`)
  }
  else if (json.type === 'array' && json.items) {
    let res
    if (Array.isArray(json.items)) {
      //TODO
      const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
      if (!IsHomogenous(json.items)) {
        throw 'Heterogenous Arrays not supported yet'
      }
      res = getSchemaType(module, json.items[0],'',schemas)
    }
    else {
      // grab the type for the non-array schema
      res = getSchemaType(module, json.items, '', schemas)
    }

    res.deps.forEach(dep => structure.deps.add(dep))
    let n = getTypeName(getModuleName(module), name || json.title)
    let def = description(name || json.title, json.description) + '\n'
    if (options.level === 0) {
      def += getObjectHandleManagement(n + 'Array') + '\n'
    }
    def += getArrayAccessors(n + 'Array', res.type)
    structure.deps.add(def)
    structure.type.push(n + 'ArrayHandle')
    return structure
  }
  else if (json.allOf) {
    let union = deepmerge.all([...json.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module, schemas) || x : x)])
    if (json.title) {
      union['title'] = json.title
    }
    else {
      union['title'] = name
    }
    delete union['$ref']
    return getSchemaType(module, union, '',schemas, options)
  }
  else if (json.oneOf || json.anyOf) {
    return structure
    //TODO
  }
  else if (json.type === 'object') {
    let res = getSchemaShape(module, json, schemas, json.title || name, {descriptions: options.descriptions, level: 0})
    res.deps.forEach(dep => structure.deps.add(dep))
    res.type.forEach(t => structure.deps.add(t))
    structure.type.push(getTypeName(getModuleName(module), json.title || name) + 'Handle')
    return structure
    //TODO
  }
  else if (json.type) {
    structure.type = getNativeType(json)
    return structure
  }
  return structure
}

function getSchemaShape(moduleJson = {}, json = {}, schemas = {}, name = '', options = {level: 0, descriptions: true}) {
    json = JSON.parse(JSON.stringify(json))
    let level = options.level
    let descriptions = options.descriptions

    let structure = {}
    structure["deps"] = new Set() //To avoid duplication of local ref definitions
    structure["type"] = []

    if (json['$ref']) {
      if (json['$ref'][0] === '#') {
        //Ref points to local schema 
        //Get Path to ref in this module and getSchemaType
        
        const schema = getPath(json['$ref'], module, schemas)
        const tname = schema.title || json['$ref'].split('/').pop()
        res = getSchemaShape(module, schema, schemas, tname, {descriptions: descriptions, level: level})
        res.deps.forEach(dep => structure.deps.add(dep))
        structure.type = res.type
      }
      else {
        // External dependency. Return only type
        // e.g, "https://meta.comcast.com/firebolt/entertainment#/definitions/ProgramType"
  
        //Get the module of this definition
        const schema = getPath(json['$ref'].split('#')[0], schemas) || module
  
        //Get the schema of the definition
        const definition = getPath(json['$ref'], schema, schemas)
        const pname = (json.title || name) + (definition.title || json['$ref'].split('/').pop())
  
        res = getSchemaShape(schema, definition, schemas, pname,{descriptions: descriptions, level: level})
        //We are only interested in the type definition for external modules
        structure.type = res.type
      }
    }
    //If the schema is a const,
    else if (json.hasOwnProperty('const')) {
      if (level > 0) {

        let t = description(name, json.description)
        typeName = getTypeName(getModuleName(moduleJson), name)
        t += getPropertyAccessors(typeName, capitalize(name), typeof json.const, {level: level, readonly:true, optional:false})
        structure.type.push(t)
      }
    }
    else if (json.type === 'object') {

      if (json.properties) {
        let tName = getTypeName(getModuleName(moduleJson), name)
        let t = description(name, json.description)
        t += '\n' +  getObjectHandleManagement(tName)
        Object.entries(json.properties).forEach(([pname, prop]) => {
          t += '\n' + description(pname, prop.description)
          let res
          if (prop.type === 'array') {
            if (Array.isArray(prop.items)) {
              //TODO
              const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
              if (!IsHomogenous(prop.items)) {
                throw 'Heterogenous Arrays not supported yet'
              }
              res = getSchemaType(moduleJson, prop.items[0],pname, schemas, {level : options.level, descriptions: options.descriptions, title: true})
            }
            else {
              // grab the type for the non-array schema
              res = getSchemaType(moduleJson, prop.items, pname, schemas, {level : options.level, descriptions: options.descriptions, title: true})
            }
            if (res.type && res.type.length > 0) {
              let n = tName + '_' + capitalize(pname || prop.title) 
              let def = getArrayAccessors(n + 'Array', res.type)
              t += '\n' + def
            }
            else {
              console.log(`WARNING: Type undetermined for ${name}:${pname}`)
            }
          } else {
            res = getSchemaType(moduleJson, prop, pname,schemas, {descriptions: descriptions, level: level + 1, title: true})
            if (res.type && res.type.length > 0) {
              t += '\n' + getPropertyAccessors(tName, capitalize(pname), res.type, {level: level, readonly:false, optional:isOptional(pname, json)})
            }
            else {
              console.log(`WARNING: Type undetermined for ${name}:${pname}`)
            }
          }
          res.deps.forEach(dep => structure.deps.add(dep))
        })
        structure.type.push(t)
      }
      else if (json.propertyNames && json.propertyNames.enum) {
        //propertyNames in object not handled yet
      }
      else if (json.additionalProperties && (typeof json.additionalProperties === 'object')) {
        //This is a map of string to type in schema
        //Get the Type
        let type = getSchemaType(moduleJson, json.additionalProperties, name,schemas)
        if (type.type && type.type.length > 0) {
          let tName = getTypeName(getModuleName(moduleJson), name)
          type.deps.forEach(dep => structure.deps.add(dep))
          let t = description(name, json.description)
          t += '\n' + getObjectHandleManagement(tName) + '\n'
          t += getMapAccessors(getTypeName(getModuleName(moduleJson), name), type.type,{descriptions: descriptions, level: level})
          structure.type.push(t)
        }
        else {
          console.log(`WARNING: Type undetermined for ${name}`)
        }
      }
      else if (json.patternProperties) {
        throw "patternProperties are not supported by Firebolt"
      }
    }
    else if (json.anyOf) {

    }
    else if (json.oneOf) {
      
    }
    else if (json.allOf) {
      let union = deepmerge.all([...json.allOf.map(x => x['$ref'] ? getPath(x['$ref'], moduleJson, schemas) || x : x)], options)
      if (json.title) {
        union['title'] = json.title
      }
      else {
        union['title'] = name
      }
      delete union['$ref']
      return getSchemaShape(moduleJson, union, schemas, name, options)

    }
    else if (json.type === 'array') {
      let res = getSchemaType(moduleJson, json, name, schemas, {level: 0, descriptions: descriptions})
      res.deps.forEach(dep => structure.deps.add(dep))
    }
    else {
      let res = getSchemaType(moduleJson, json, name, schemas, {level: level, descriptions: descriptions})
      res.deps.forEach(dep => structure.deps.add(dep))
    }
    return structure
  }

  function getPropertyGetterSignature(method, module, paramType) {
    let m = `${capitalize(getModuleName(module))}_Get${capitalize(method.name)}`
    return `${description(method.name, method.summary)}\nuint32 ${m}( ${paramType === 'char*' ? 'FireboltTypes_StringHandle' : paramType}* ${method.result.name || method.name} )`
  }

  function getPropertySetterSignature(method, module, paramType) {
    let m = `${capitalize(getModuleName(module))}_Set${capitalize(method.name)}`
    return `${description(method.name, method.summary)}\nuint32 ${m}( ${paramType} ${method.result.name || method.name} )`
  }

  function getPropertyEventCallbackSignature(method, module, paramType) {
    return `typedef void (*On${capitalize(method.name)}Changed)(${paramType === 'char*' ? 'FireboltTypes_StringHandle' : paramType})`
  }

  function getPropertyEventSignature(method, module) {
    return `${description(method.name, 'Listen to updates')}\n` + `uint32_t ${capitalize(getModuleName(module))}_Listen${capitalize(method.name)}Update(On${capitalize(method.name)}Changed notification, uint16_t* listenerId)`
  }

  export {
    getHeaderText,
    getIncludeGuardOpen,
    getStyleGuardOpen,
    getStyleGuardClose,
    getIncludeGuardClose,
    getNativeType,
    getSchemaType,
    getSchemaShape,
    getModuleName,
    getIncludeDefinitions,
    getPropertyGetterSignature,
    getPropertySetterSignature,
    getPropertyEventCallbackSignature,
    getPropertyEventSignature,
    capitalize,
    description,
    getTypeName
  }
