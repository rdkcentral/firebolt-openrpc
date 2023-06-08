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
import { str } from 'ajv'

const { isObject, isArray, propEq, pathSatisfies, hasProp, propSatisfies } = predicates

const getModuleName = json => getPathOr(null, ['info', 'title'], json) || json.title || 'missing'

const getFireboltStringType = () => 'FireboltTypes_StringHandle'
const getSdkNameSpace = () => 'FireboltSDK'
const getJsonDataPrefix = () => 'JsonData_'
const wpeJsonNameSpace = () => 'WPEFramework::Core::JSON'
const getJsonNativeTypeForOpaqueString = () => getSdkNameSpace() + '::JSON::String'

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

const getNativeType = (json, stringAsHandle = false) => {
  let type
  let jsonType = json.const ? typeof json.const : json.type
  if (jsonType === 'string') {
      type = 'char*'
      if(stringAsHandle) {
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
  return type
}

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

const IsResultBooleanSuccess = (method) => (method && method.result && method.result.name === 'success' && (method.result.schema.type === 'boolean' || method.result.schema.const))

const areParamsValid = (params) => params.every(p => p.type && (p.type.length > 0))

const generateMethodParamsSignature = (params, event = false) => {
    let signatureParams = ''
    params.forEach(p => {
      signatureParams += (signatureParams.length > 0) ? ', ' : ''
      let type = p.nativeType

      if ((event === true) && (type == 'char*')) {
        type = getFireboltStringType()
      }
      if (p.required === true) {
        signatureParams += `${type} ${p.name}`
      }
      else if (p.required === false) {
        signatureParams += (((type === 'char*') || (type.includes('Handle') == true)) ? `${type} ${p.name}` : `${type}* ${p.name}`)
      }
    })
    return signatureParams
}

const getParamsSignature = (info, signature, method, getter = true, eventCB = false, innerCB = false, anyOfParam) => {
  let param = ''
  let sig = {}
  sig["signature"] = {}
  sig["anyOfParam"] = {}

  if (anyOfParam) {
    signature +=  '_' + anyOfParam.json.title
    param += `${anyOfParam.type} ${camelcase(anyOfParam.json.title)}`
    sig.anyOfParam = anyOfParam
  }

  if (eventCB === true) {
    if (innerCB === true) {
      signature += 'InnerCallback'
      param = 'void* userCB, const void* userData, void* response'
    }
    else {
      signature += ')'
      param = 'const void* userData' + (param.length > 0 ? ', ' : '') + param
    }
  }

  signature += '( ' + param
  if ((innerCB === false) && (info.params.length > 0) && areParamsValid(info.params)) {
    signature += (param.length > 0 ? ', ' : '')
    signature += generateMethodParamsSignature(info.params, eventCB)
  }
  if (innerCB === false) {
    if (info["result"] && (info["result"].length > 0) && (IsResultBooleanSuccess(method) !== true)) {
      if ((info.params.length > 0) || (param.length > 0)) {
        signature += ', '
      }
      if (getter === true) {
        signature += `${info["result"]}* ${method.result.name || method.name}`
      }
      else {
        signature += `${info["result"]} ${method.result.name || method.name}`
      }
    } else if (info.params.length === 0 && param.length === 0) {
      signature += 'void'
    }
  }
  signature += ' )'
  sig.signature = signature
  info.signatures.push(sig)
  return info
}

function generateMethodSignature(signature, method, module, info, getter, eventCB = false, innerCB = false, prefix = '') {

  info["signatures"] = []
  if (info.anyOfParams) {
    info.anyOfParams.forEach(param => {
      info = getParamsSignature(info, signature, method, getter, eventCB, innerCB, param)
    })
  } else {
    info = getParamsSignature(info, signature, method, getter, eventCB, innerCB)
  }
  return info
}

function generateEventCallbackSignature(methodName, method, module, info, prefix = '') {
  let signature = `typedef void ${methodName}`
  return generateMethodSignature(signature, method, module, info, false, true, false)
}

function generateEventInnerCallbackSignature(signature, method, module, info, prefix = '') {
  return generateMethodSignature(signature, method, module, info, false, true, true)
}

function getEventParamsSignature(info, rsig, unrsig, callbackName, anyOfParam) {
  let signature = {}
  signature["rsig"] = []
  signature["unrsig"] = []

  if (anyOfParam) {
    rsig += '_' + anyOfParam.json.title
    unrsig += '_' + anyOfParam.json.title
    callbackName += '_' + anyOfParam.json.title
    signature["anyOfParam"] = anyOfParam
  }

  rsig += 'Update('
  unrsig += 'Update('

  let params = ''
  if (areParamsValid(info.params)) {
    params += generateMethodParamsSignature(info.params)
    rsig += params
  }

  if (info["result"] && (info["result"].length > 0) && (IsResultBooleanSuccess(method) !== true)) {
    info.result.push(`${info["result"]} ${method.result.name || method.name}`)
  }
  rsig += (params.length > 0) ? ',' : ''
  rsig += ` ${callbackName} userCB, const void* userData )`
  unrsig += ` ${callbackName} userCB)`

  signature.rsig = rsig
  signature.unrsig = unrsig
  info.signatures.push(signature)

  return info
}

function generateEventSignature(callbackName, method, module, info, prefix = '') {
  let registersig = `uint32_t ${capitalize(getModuleName(module))}_Register_${capitalize(method.name)}`
  let unregistersig = `uint32_t ${capitalize(getModuleName(module))}_Unregister_${capitalize(method.name)}`
  info['result'] = ''

  info["signatures"] = []
  if (info.anyOfParams) {
    info.anyOfParams.forEach(param => {
      info = getEventParamsSignature(info, registersig, unregistersig, callbackName, param)
    })
  } else {
    info = getEventParamsSignature(info, registersig, unregistersig, callbackName)
  }
  return info
}

function getPropertyGetterSignature(method, module, info) {
  let signature = `uint32_t ${capitalize(getModuleName(module))}_Get${capitalize(method.name)}`
  return generateMethodSignature(signature, method, module, info, true)
}

function getPropertySetterSignature(method, module, info) {
  let signature = `uint32_t ${capitalize(getModuleName(module))}_Set${capitalize(method.name)}`
  return generateMethodSignature(signature, method, module, info, false)
}

function getPropertyEventCallbackSignature(method, module, info) {
  let methodName = capitalize(getModuleName(module)) + capitalize(method.name)
  return generateEventCallbackSignature(`(*On${methodName}Changed`, method, module, info)
}

function getPropertyEventInnerCallbackSignature(method, module, info) {
  let signature = `static void ${capitalize(getModuleName(module)) + capitalize(method.name)}`
  return generateEventInnerCallbackSignature(signature, method, module, info)
}

function getPropertyEventSignature(method, module, info) {
  let methodName = capitalize(getModuleName(module)) + capitalize(method.name)
  return generateEventSignature(`On${methodName}Changed`, method, module, info)
}

function getEventCallbackSignature(method, module, info) {
  let methodName = capitalize(getModuleName(module)) + capitalize(method.name)
  return generateEventCallbackSignature(`(*${methodName}Callback`, method, module, info)
}

function getEventInnerCallbackSignature(method, module, info) {
  let signature = `static void ${capitalize(getModuleName(module)) + capitalize(method.name)}`
  return generateEventInnerCallbackSignature(signature, method, module, info)
}

function getEventSignature(method, module, info, prefix = '') {
  let methodName = capitalize(getModuleName(module)) + capitalize(method.name)
  return generateEventSignature(`${prefix}${methodName}Callback`, method, module, info)
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
    getPropertyEventSignature,
    getPropertyEventCallbackSignature,
    getPropertyEventInnerCallbackSignature,
    getEventSignature,
    getEventCallbackSignature,
    getEventInnerCallbackSignature,
    getMapAccessors,
    getArrayAccessors,
    capitalize,
    description,
    getTypeName,
    getObjectHandleManagement,
    getPropertyAccessors,
    isOptional,
    generateEnum,
    getFireboltStringType,
    getArrayElementSchema,
    getJsonDataPrefix,
    getSdkNameSpace,
    wpeJsonNameSpace,
    getJsonNativeTypeForOpaqueString
}
