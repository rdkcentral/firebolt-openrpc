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
    getModuleName,
    getIncludeDefinitions,
    getPropertyGetterSignature,
    getPropertySetterSignature,
    getPropertyEventCallbackSignature,
    getPropertyEventSignature,
    getMapAccessors,
    getArrayAccessors,
    capitalize,
    description,
    getTypeName,
    getObjectHandleManagement,
    getPropertyAccessors,
    isOptional,
    generateEnum
  }
