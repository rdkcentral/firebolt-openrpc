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

const enumReducer = (acc, val, i, arr) => {
    const keyName = getSafeName(val.replace(/[\.\- ]/g, '_').replace(/\+/g, '_plus').replace(/([a-z])([A-Z0-9])/g, '$1_$2').toUpperCase())
    acc = acc + `    ${keyName}: '${val}'`
    if (i < arr.length-1) {
      acc = acc.concat(',\n')
    }
    return acc
  }
  
const generateEnum = schema => {
  if (!schema.enum) {
    return ''
  }
  else {
    let str = '{\n'
    str += schema.enum.reduce(enumReducer, '')
    str += '\n}\n'
    return str
  }
}

const reserved = [
'break',
'case', 
'catch', 
'class', 
'const', 
'continue', 
'debugger', 
'default', 
'delete', 
'do',
'else', 
'export', 
'extends',
'finally',
'for',
'function',
'if',
'import',
'in',
'instanceof',
'new',
'return',
'super',
'switch',
'this',
'throw',
'try',
'typeof',
'var',
'void',
'while',
'with',
'yield'
]

function getSafeName(name) {
  name = name .replace(/\ /g, '_')
              .replace(/\-/g, '_')

  if (reserved.includes(name)) {
    name = '_' + name
  }

  return name
}

function getMethodSignature(module, method, options={ isInterface: false }) {
  let javascript = (isInterface ? '' : 'function ') + getSafeName(method.name) + '('
  javascript += getMethodSignatureParams(module, method)
  javascript += ')'
  
  return javascript
}

function getMethodSignatureParams(module, method) {
  if (method.params)
    return method.params.map( param => param.name ).join(', ')
  else
    return ''
}

const getEventName = x => (x[3].match(/[A-Z]/) ? x[2] : x[2].toLowerCase()) + x.substr(3) // onFooBar becomes fooBar, onFOOBar becomes FOOBar

export {
    generateEnum,
    getMethodSignature,
    getMethodSignatureParams,
    getEventName,
    getSafeName
}