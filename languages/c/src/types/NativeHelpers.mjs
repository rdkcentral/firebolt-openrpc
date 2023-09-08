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

const getFireboltStringType = () => 'Firebolt_String_t'

const capitalize = str => str[0].toUpperCase() + str.substr(1)
const description = (title, str='') => '/* ' + title + (str.length > 0 ? ' - ' + str : '') + ' */'
const isOptional = (prop, json) => (!json.required || !json.required.includes(prop))

const SdkTypesPrefix = 'Firebolt'

const Indent = '    '

const getNativeType = (json, fireboltString = false) => {
  let type
  let jsonType = json.const ? typeof json.const : json.type
  if (jsonType === 'string') {
      type = 'char*'
      if (fireboltString) {
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

const getObjectManagement = varName => {

    let result = `typedef struct ${varName}_s* ${varName}_t;
${varName}_t ${varName}_Acquire(void);
void ${varName}_Addref(${varName}_t handle);
void ${varName}_Release(${varName}_t handle);
bool ${varName}_IsValid(${varName}_t handle);
`
    return result
}

const getPropertyAccessors = (objName, propertyName, propertyType,  options = {level:0, readonly:false, optional:false}) => {
  let result = `${Indent.repeat(options.level)}${propertyType} ${objName}_Get_${propertyName}(${objName}_t handle);` + '\n'

  if (!options.readonly) {
    let type = (propertyType === getFireboltStringType()) ? 'char*' : propertyType
    result += `${Indent.repeat(options.level)}void ${objName}_Set_${propertyName}(${objName}_t handle, ${type} ${propertyName.toLowerCase()});` + '\n'
  }

  if (options.optional === true) {
    result += `${Indent.repeat(options.level)}bool ${objName}_Has_${propertyName}(${objName}_t handle);` + '\n'
    result += `${Indent.repeat(options.level)}void ${objName}_Clear_${propertyName}(${objName}_t handle);` + '\n'
  }

  return result
}

const getMapAccessors = (typeName, accessorPropertyType, level = 0) => {

  let res

  res = `${Indent.repeat(level)}uint32_t ${typeName}_KeysCount(${typeName}_t handle);` + '\n'
  res += `${Indent.repeat(level)}void ${typeName}_AddKey(${typeName}_t handle, char* key, ${accessorPropertyType} value);` + '\n'
  res += `${Indent.repeat(level)}void ${typeName}_RemoveKey(${typeName}_t handle, char* key);` + '\n'
  res += `${Indent.repeat(level)}${accessorPropertyType} ${typeName}_FindKey(${typeName}_t handle, char* key);` + '\n'

  return res
}

const getTypeName = (moduleName, varName, prefix = '', upperCase = false, capitalCase = true) => {

  let mName = upperCase ? moduleName.toUpperCase() : capitalize(moduleName)
  let vName = upperCase ? varName.toUpperCase() : capitalCase ? capitalize(varName) : varName
  if (prefix && prefix.length > 0) {
    prefix = (prefix !== varName) ? (upperCase ? prefix.toUpperCase() : capitalize(prefix)) : ''
  }
  prefix = (prefix && prefix.length > 0) ?(upperCase ? prefix.toUpperCase() : capitalize(prefix)) : prefix
  let name = (prefix && prefix.length > 0) ? `${mName}_${prefix}_${vName}` : `${mName}_${vName}`
  return name
}

const getArrayAccessors = (arrayName, propertyType, valueType) => {

  let res = `uint32_t ${arrayName}Array_Size(${propertyType}_t handle);` + '\n'
  res += `${valueType} ${arrayName}Array_Get(${propertyType}_t handle, uint32_t index);` + '\n'
  res += `void ${arrayName}Array_Add(${propertyType}_t handle, ${valueType} value);` + '\n'
  res += `void ${arrayName}Array_Clear(${propertyType}_t handle);` + '\n'

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
  return `int32_t ${capitalize(getModuleName(module))}_Get${capitalize(property.name)}( ${contextParams}${contextParams.length > 0 ? ', ':''}${propType}* ${property.result.name || property.name} )`
}

export {
    getNativeType,
    getModuleName,
    getPropertyGetterSignature,
    getMapAccessors,
    getArrayAccessors,
    capitalize,
    description,
    getTypeName,
    getObjectManagement,
    getPropertyAccessors,
    isOptional,
    generateEnum,
    getFireboltStringType
}
