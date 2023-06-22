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

const getFireboltStringType = () => 'FireboltTypes_StringHandle'
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

const getArrayElementSchema = (json, module, schemas = {}, name) => {
  let result = ''
  if (json.type === 'array' && json.items) {
    if (Array.isArray(json.items)) {
      result = json.items[0]
    }
    else {
      // grab the type for the non-array schema
      result = json.items
    }
    if (result['$ref']) {
      result = getPath(result['$ref'], module, schemas)
    }
  }
  else if (json.type == 'object') {
    if (json.properties) {
      Object.entries(json.properties).every(([pname, prop]) => {
        if (prop.type === 'array') {
          result = getArrayElementSchema(prop, module, schemas)
          if (name === capitalize(pname)) {
             return false
          }
        }
        return true
      })
    }
  }

  return result
}

const getNativeType = (json, stringAsHandle = false) => {
  let type
  let jsonType = json.const ? typeof json.const : json.type
  if (jsonType === 'string') {
      type = 'char*'
      if (stringAsHandle) {
        type = getFireboltStringType()
      }
  }
  else if (jsonType === 'number') {
      type = 'float'
  }
  else if (jsonType === 'integer') {
      type = 'int32_t'

  }
  else if (jsonType === 'boolean') {
    type = 'bool'
  }
  else if (jsonType === 'null' ) {
    type = 'void'
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
    let type = (propertyType === getFireboltStringType()) ? 'char*' : propertyType
    result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}Handle handle, ${type} ${propertyName.toLowerCase()});` + '\n'
  }

  if (options.optional === true) {
    result += `${Indent.repeat(options.level)}bool ${objName}_Has_${propertyName}(${objName}Handle handle);` + '\n'
    result += `${Indent.repeat(options.level)}void ${objName}_Clear_${propertyName}(${objName}Handle handle);` + '\n'
  }

  return result
}

const getMapAccessors = (typeName, accessorPropertyType, level = 0) => {

  let res

  res = `${Indent.repeat(level)}uint32_t ${typeName}_KeysCount(${typeName}Handle handle);` + '\n'
  res += `${Indent.repeat(level)}void ${typeName}_AddKey(${typeName}Handle handle, char* key, ${accessorPropertyType} value);` + '\n'
  res += `${Indent.repeat(level)}void ${typeName}_RemoveKey(${typeName}Handle handle, char* key);` + '\n'
  res += `${Indent.repeat(level)}${accessorPropertyType} ${typeName}_FindKey(${typeName}Handle handle, char* key);` + '\n'

  return res
}

const getTypeName = (moduleName, varName, prefix = '', upperCase = false, capitalCase = true) => {

  let mName = upperCase ? moduleName.toUpperCase() : capitalize(moduleName)
  let vName = upperCase ? varName.toUpperCase() : capitalCase ? capitalize(varName) : varName
  if (prefix.length > 0) {
    prefix = (!varName.startsWith(prefix)) ? (upperCase ? prefix.toUpperCase() : capitalize(prefix)) : ''
  }
  prefix = (prefix.length > 0) ?(upperCase ? prefix.toUpperCase() : capitalize(prefix)) : prefix
  let name = (prefix.length > 0) ? `${mName}_${prefix}_${vName}` : `${mName}_${vName}`
  return name
}

const getArrayAccessors = (arrayName, propertyType, valueType) => {

  let res = `uint32_t ${arrayName}Array_Size(${propertyType}Handle handle);` + '\n'
  res += `${valueType} ${arrayName}Array_Get(${propertyType}Handle handle, uint32_t index);` + '\n'
  res += `void ${arrayName}Array_Add(${propertyType}Handle handle, ${valueType} value);` + '\n'
  res += `void ${arrayName}Array_Clear(${propertyType}Handle handle);` + '\n'

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

/*
paramList = [{name='', nativeType='', jsonType='', required=boolean}]
*/

const getContextParams = (paramList) => paramList.map(param => param.nativeType + (!param.required ? '*' : '') + ' ' + param.name).join(', ')

function getPropertyGetterSignature(property, module, propType, paramList = []) {

  let contextParams = ''
  contextParams = getContextParams(paramList)
  return `uint32_t ${capitalize(getModuleName(module))}_Get${capitalize(property.name)}( ${contextParams}${contextParams.length > 0 ? ', ':''}${propType}* ${property.result.name || property.name} )`
}

function getPropertySetterSignature(property, module, propType, paramList = []) {
  let contextParams = ''
  contextParams = getContextParams(paramList)
  if (propType === getFireboltStringType()) {
    propType = 'char*'
  }
  return `uint32_t ${capitalize(getModuleName(module))}_Set${capitalize(property.name)}( ${contextParams}${contextParams.length > 0 ? ', ':''}${propType} ${property.result.name || property.name} )`
}

function getPropertyEventCallbackSignature(property, module, propType, paramList = []) {

  let contextParams = ''
  contextParams = getContextParams(paramList)
  return `/*Callback to listen to updates on ${property.Name} property*/\n` +
  `typedef void (*On${capitalize(getModuleName(module))}${capitalize(property.name)}Changed)( ${contextParams}${contextParams.length > 0 ? ', ':''}const void* userData, ${propType} ${property.result.name || property.name})`
}

function getPropertyEventInnerCallbackSignature(method, module, schemas) {
  let signature = `static void ${capitalize(getModuleName(module)) + capitalize(method.name)}`
}

function getPropertyEventRegisterSignature(property, module, paramList = []) {
  let contextParams = ''
  contextParams = getContextParams(paramList)

  return `/*Register to listen to updates on ${capitalize(property.name)} property*/\n` +
  `uint32_t ${capitalize(getModuleName(module))}_Register_${capitalize(property.name)}Update( ${contextParams}${contextParams.length > 0 ? ', ':''}On${capitalize(getModuleName(module))}${capitalize(property.name)}Changed userCB, const void* userData )`

}

function getPropertyEventUnregisterSignature(property, module) {
  return `/*Unregister to listen to updates on ${capitalize(property.name)} property*/\n` +
  `uint32_t ${capitalize(getModuleName(module))}_Unregister_${capitalize(property.name)}Update( On${capitalize(getModuleName(module))}${capitalize(property.name)}Changed userCB )`

}


export {
    getHeaderText,
    getIncludeGuardOpen,
    getStyleGuardOpen,
    getStyleGuardClose,
    getIncludeGuardClose,
    getNativeType,
    getModuleName,
    getPropertyGetterSignature,
    getPropertySetterSignature,
    getPropertyEventCallbackSignature,
    getPropertyEventRegisterSignature,
    getPropertyEventUnregisterSignature,
    getMapAccessors,
    getArrayAccessors,
    capitalize,
    description,
    getTypeName,
    getObjectHandleManagement,
    getPropertyAccessors,
    isOptional,
    generateEnum,
    getArrayElementSchema,
    getFireboltStringType
}
