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
import helpers from 'crocks/helpers/index.js'
const { compose } = helpers
import pointfree from 'crocks/pointfree/index.js'
const { filter, map, reduce } = pointfree
import { getPath } from '../../src/shared/json-schema.mjs'
import { getTypeName, getModuleName, description, getObjectHandleManagement, getNativeType, getPropertyAccessors, capitalize, isOptional, generateEnum, getMapAccessors, getArrayAccessors, getArrayElementSchema, getSdkNameSpace, getPropertyGetterSignature, getPropertySetterSignature, getPropertyEventSignature, getPropertyEventCallbackSignature, getFireboltStringType } from './src/types/NativeHelpers.mjs'
import { getArrayAccessorsImpl, getMapAccessorsImpl, getObjectHandleManagementImpl, getPropertyAccessorsImpl, getPropertyGetterImpl, getPropertySetterImpl, getPropertyEventCallbackImpl, getPropertyEventImpl } from './src/types/ImplHelpers.mjs'
import { getJsonContainerDefinition, getJsonDataStructName } from './src/types/JSONHelpers.mjs'

const getJsonNativeTypeForOpaqueString = () => getSdkNameSpace() + '::JSON::String'
const getEnumName = (name, prefix) => ((prefix.length > 0) ? (prefix + '_' + name) : name)

const getRefModule = (title) => {
  let module = {
    info: {
      title: `${title}`
    }
  }
  return module
}

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

function union(schemas, module, commonSchemas) {

  const result = {};
  for (const schema of schemas) {
    for (const [key, value] of Object.entries(schema)) {
      if (!result.hasOwnProperty(key)) {
        // If the key does not already exist in the result schema, add it
        if (value && value.anyOf) {
          result[key] = union(value.anyOf, module, commonSchemas)
        } else if (key === 'title' || key === 'description' || key === 'required') {
          //console.warn(`Ignoring "${key}"`)
        } else {
          result[key] = value;
        }
      } else if (key === 'type') {
        // If the key is 'type', merge the types of the two schemas
        if(result[key] === value) {
          //console.warn(`Ignoring "${key}" that is already present and same`)
        } else {
          console.warn(`ERROR "${key}" is not same -${JSON.stringify(result, null, 4)} ${key} ${result[key]} - ${value}`)
          console.trace()
          throw "ERROR: type is not same"
        }
      } else {
        //If the Key is a const then merge them into an enum
        if(value && value.const) {
          if(result[key].enum) {
            result[key].enum = Array.from(new Set([...result[key].enum, value.const]))
          }
          else {
            result[key].enum = Array.from(new Set([result[key].const, value.const]))
            delete result[key].const
          }
        }
        // If the key exists in both schemas and is not 'type', merge the values
        else if (Array.isArray(result[key])) {
          // If the value is an array, concatenate the arrays and remove duplicates
          result[key] = Array.from(new Set([...result[key], ...value]))
        } else if (result[key] && result[key].enum && value && value.enum) {
          //If the value is an enum, merge the enums together and remove duplicates
          result[key].enum = Array.from(new Set([...result[key].enum, ...value.enum]))
        } else if (typeof result[key] === 'object' && typeof value === 'object') {
          // If the value is an object, recursively merge the objects
          result[key] = union([result[key], value], module, commonSchemas);
        } else if (result[key] !== value) {
          // If the value is a primitive and is not the same in both schemas, ignore it
          //console.warn(`Ignoring conflicting value for key "${key}"`)
        }
      }
    }
  }
  return result;
}

function getMergedSchema(module, json, name, schemas) {
  let refsResolved = [...json.anyOf.map(x => x['$ref'] ? getPath(x['$ref'], module, schemas) || x : x)]
  let allOfsResolved = refsResolved.map(sch => sch.allOf ? deepmerge.all([...sch.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module, schemas) || x : x)]) : sch)

  let mergedSchema = union(allOfsResolved, module, schemas)
  if (json.title) {
    mergedSchema['title'] = json.title
  }
  else {
    mergedSchema['title'] = name
  }

  delete mergedSchema['$ref']
  return mergedSchema
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
  validateParamsAndResult(method, module)
  let info = getParamsInfo(method, module)
  let impl = ''
  if (hasTag(method, 'property') ||
      hasTag(method, 'property:readonly') || hasTag(method, 'property:immutable')) {
    let tag = getTagName(method, 'property')
    switch(tag) {
    case 'property':
      getPropertySetterSignature(method, module, Object.assign({}, info)).signatures.forEach(s => impl += (s.signature + ';\n'))
    case 'property:readonly':
      getPropertyEventCallbackSignature(method, module, Object.assign({}, info)).signatures.forEach(s => impl += (s.signature + ';\n'))
      getPropertyEventSignature(method, module, Object.assign({}, info)).signatures.forEach(s => impl += (s.rsig + ';\n' + s.unrsig + ';\n'))
    case 'property:immutable':
      getPropertyGetterSignature(method, module, Object.assign({}, info)).signatures.forEach(s => impl += (s.signature))
      break;
    default:
      console.log(`WARNING invalid tag: ${tag} for method ${method.name}`)
      break;
    }
  }
  return impl
}

function getMethodSignatureParams(method, module, { destination }) {

  return method.params.map(param => param.name + (!param.required ? '?' : '') + ': ' + getSchemaType(param.schema, module, { name: param.name, title: true, destination })).join(', ')
}

const safeName = prop => prop.match(/[.+]/) ? '"' + prop + '"' : prop

function getSchemaType(schema, module, { name, prefix = '', destination, resultSchema = true, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {
  let info = getSchemaTypeInfo(module, schema, name, module['x-schemas'], prefix, { title: title, resultSchema : resultSchema, event : false })
  return info.type
}

function getSchemaTypeInfo(module = {}, json = {}, name = '', schemas = {}, prefix = '', options = {level: 0, descriptions: true, title: false, resultSchema: false, event: false}) {

  let stringAsHandle = options.resultSchema || options.event

  if (json.schema) {
    json = json.schema
  }

  let info = {}
  info["type"] = ''
  info["json"] = []
  info["name"] = {}
  info["namespace"] = {}

  if (json['$ref']) {
    if (json['$ref'][0] === '#') {
      //Ref points to local schema
      //Get Path to ref in this module and getSchemaType
      let definition = getPath(json['$ref'], module, schemas)
      let tName = definition.title || json['$ref'].split('/').pop()
      let schema = module
      if (json['$ref'].includes('x-schemas')) {
        schema = (getRefModule(json['$ref'].split('/')[2]))
      }

      const res = getSchemaTypeInfo(schema, definition, tName, schemas, '', options)
      info.type = res.type
      info.json = res.json
      info.name = res.name
      info.namespace = res.namespace
      return info
    }
  }
  else if (json.const) {
    info.type = getNativeType(json, stringAsHandle)
    info.json = json
    return info
  }
  else if (json['x-method']) {
    console.log(`WARNING UNHANDLED: x-method in ${name}`)
    return info
    //throw "x-methods not supported yet"
  }
  else if (json.type === 'string' && json.enum) {
    //Enum
    info.name = name || json.title
    let typeName = getTypeName(getModuleName(module), name || json.title, prefix, false, false)
    let res = description(capitalize(name || json.title), json.description) + '\n' + generateEnum(json, typeName)
    info.json = json
    info.type = typeName
    info.namespace = getModuleName(module)
    return info
  }
  else if (Array.isArray(json.type)) {
    let type = json.type.find(t => t !== 'null')
    let sch = JSON.parse(JSON.stringify(json))
    sch.type = type
    return getSchemaTypeInfo(module, sch, name, schemas, prefix, options)
  }
  else if (json.type === 'array' && json.items && (validJsonObjectProperties(json) === true)) {
    let res = ''
    if (Array.isArray(json.items)) {
            //TODO
      const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
      if (!IsHomogenous(json.items)) {
        throw 'Heterogenous Arrays not supported yet'
      }
      res = getSchemaTypeInfo(module, json.items[0], json.items[0].name || name, schemas, prefix)
    }
    else {
      // grab the type for the non-array schema
      res = getSchemaTypeInfo(module, json.items, json.items.name || name, schemas, prefix)
    }

    let arrayName = capitalize(res.name) + capitalize(res.json.type)
    let n = getTypeName(getModuleName(module), arrayName, prefix)
    info.name = res.name || name && (capitalize(name))
    info.type = n + 'ArrayHandle'
    info.json = json
    info.namespace = getModuleName(module)
    return info
  }
  else if (json.allOf) {
    let title = json.title ? json.title : name
    let union = deepMergeAll(module, title, json, schemas, options)
    union['title'] = title

    delete union['$ref']
    return getSchemaTypeInfo(module, union, '', schemas, '', options)
  }
  else if (json.oneOf) {
    info.type = 'char*'
    info.json.type = 'string'
    return info
  }
  else if (json.anyOf) {
    let mergedSchema = getMergedSchema(module, json, name, schemas)
    let prefixName = ((prefix.length > 0) && (!name.startsWith(prefix))) ? prefix : capitalize(name)
    return getSchemaTypeInfo(module, mergedSchema, '', schemas, prefixName, options)
  }
  else if (json.type === 'object') {
    info.json = json
    if (hasProperties(json)) {
      info.type = getTypeName(getModuleName(module), json.title || name, prefix) + 'Handle'
      info.name = (json.name ? json.name : (json.title ? json.title : name))
      info.namespace = (json.namespace ? json.namespace : getModuleName(module))
    }
    else {
      info.type = 'char*'
    }
    if (name) {
      info.name = capitalize(name)
    }

    return info
  }
  else if (json.type) {
    info.type = getNativeType(json, stringAsHandle)
    info.json = json
    if (name || json.title) {
      info.name = capitalize(name || json.title)
    }
    info.namespace = getModuleName(module)

    return info
  }
  return info
}

function getSchemaShape(json, module, { name = '', prefix = '', level = 0, title, summary, descriptions = true, destination = '', section = '', enums = true } = {}) {

  let shape = getSchemaShapeInfo(json, module, module['x-schemas'], { name, prefix, merged: false, level, title, summary, descriptions, destination, section, enums })
    return shape
}
function getSchemaShapeInfo(json, module, schemas = {}, { name = '', prefix = '', merged = false, level = 0, title, summary, descriptions = true, destination = '', section = '', enums = true } = {}) {
  let shape = ''

  if (destination && section) {
    const isHeader = (destination.includes("JsonData_") !== true) && destination.endsWith(".h")
    const isCPP = ((destination.endsWith(".cpp") || destination.includes("JsonData_")) && (section.includes('accessors') !== true))
    json = JSON.parse(JSON.stringify(json))

    name = json.title || name

    if (json['$ref']) {
      if (json['$ref'][0] === '#') {
        //Ref points to local schema
        //Get Path to ref in this module and getSchemaType
        const schema = getPath(json['$ref'], module, schemas)
        const tname = schema.title || json['$ref'].split('/').pop()
        if (json['$ref'].includes('x-schemas')) {
          schema = (getRefModule(json['$ref'].split('/')[2]))
        }

        shape = getSchemaShapeInfo(schema, module, schemas, { name, prefix, merged, level, title, summary, descriptions, destination, section, enums })
      }
    }
    //If the schema is a const,
    else if (json.hasOwnProperty('const') && !isCPP) {
      if (level > 0) {

        let t = description(capitalize(name), json.description)
        typeName = getTypeName(getModuleName(module), name, prefix)
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
        let c_shape = description(capitalize(name), json.description)
        let cpp_shape = ''
        let tName = getTypeName(getModuleName(module), name, prefix)
        c_shape += '\n' + (isHeader ? getObjectHandleManagement(tName) : getObjectHandleManagementImpl(tName, getJsonType(json, module, { name })))
        let props = []
        let containerName = ((prefix.length > 0) && (!name.startsWith(prefix))) ? (prefix + '_' + capitalize(name)) : capitalize(name)
        Object.entries(json.properties).forEach(([pname, prop]) => {
          let items
          var desc = '\n' + description(capitalize(pname), prop.description)
          if (prop.type === 'array') {
            if (Array.isArray(prop.items)) {
              //TODO
              const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
              if (!IsHomogenous(prop.items)) {
                throw 'Heterogenous Arrays not supported yet'
              }
              items = prop.items[0]
            }
            else {
              // grab the type for the non-array schema
              items = prop.items
            }

            let info = getSchemaTypeInfo(module, items, items.name || pname, schemas, prefix, {level : level, descriptions: descriptions, title: true})
            if (info.type && info.type.length > 0) {
              let objName = tName + '_' + capitalize(prop.title || pname)
              let moduleName = info.namespace
              info.json.namespace = info.namespace
              let moduleProperty = getJsonTypeInfo(module, json, json.title || name, schemas, prefix)
              let prefixName = ((prefix.length > 0) && items['$ref']) ? '' : prefix
              let subModuleProperty = getJsonTypeInfo(module, info.json, info.name, schemas, prefix)

              let t = description(capitalize(info.name), json.description) + '\n'
              t += '\n' + (isHeader ? getArrayAccessors(objName, tName, info.type) : getArrayAccessorsImpl(tName, moduleProperty.type, (tName + 'Handle'), subModuleProperty.type, capitalize(pname || prop.title), info.type, info.json))
              c_shape += '\n' + t
              props.push({name: `${pname}`, type: `WPEFramework::Core::JSON::ArrayType<${subModuleProperty.type}>`})
            }
            else {
              console.log(`a. WARNING: Type undetermined for ${name}:${pname}`)
            }
          } else {
            if (((merged === false) || ((merged === true) && (pname.includes(name)))) && (prop.type === 'object' || prop.anyOf || prop.allOf)) {
              shape += getSchemaShapeInfo(prop, module, schemas, { name : pname, prefix, merged: false, level: 1, title, summary, descriptions, destination, section, enums })
            }
            let info = getSchemaTypeInfo(module, prop, pname, module['x-schemas'], prefix, {descriptions: descriptions, level: level + 1, title: true})
            if (info.type && info.type.length > 0) {
              let subPropertyName = ((pname.length !== 0) ? capitalize(pname) : info.name)
              let moduleProperty = getJsonTypeInfo(module, json, name, schemas, prefix)
              let subProperty = getJsonTypeInfo(module, prop, pname, schemas, prefix)
              c_shape += '\n' + description(capitalize(pname), info.json.description)
              c_shape += '\n' + (isHeader ? getPropertyAccessors(tName, capitalize(pname), info.type, { level: 0, readonly: false, optional: isOptional(pname, json) }) : getPropertyAccessorsImpl(tName, moduleProperty.type, subProperty.type, subPropertyName, info.type, info.json, {readonly:false, optional:isOptional(pname, json)}))
              let property = getJsonType(prop, module, { name : pname, prefix })
              props.push({name: `${pname}`, type: `${property}`})
            }
            else {
              console.log(`b. WARNING: Type undetermined for ${name}:${pname}`)
            }
          }
        })

        cpp_shape += getJsonContainerDefinition(json, containerName, props)

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
        let info = getSchemaTypeInfo(module, json.additionalProperties, name, module['x-schemas'], prefix)
        if (!info.type || (info.type.length === 0)) {
          info.type = 'char*'
          info.json = json.additionalProperties
          info.json.type = 'string'
        }

        let tName = getTypeName(getModuleName(module), name, prefix)
        let t = description(capitalize(name), json.description) + '\n'
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
        console.log(`WARNING: patternProperties are not supported by Firebolt(inside getModuleName(module):${name})`)
      }
    }
    else if (json.anyOf) {
      if (level > 0) {
        let mergedSchema = getMergedSchema(module, json, name, schemas)
        let prefixName = ((prefix.length > 0) && (!name.startsWith(prefix))) ? prefix : capitalize(name)
        shape += getSchemaShapeInfo(mergedSchema, module, schemas, { name, prefix: prefixName, merged, level, title, summary, descriptions, destination, section, enums })
      }
    }
    else if (json.oneOf) {
      //Just ignore schema shape, since this has to be treated as string
    }
    else if (json.allOf) {
      let title = (json.title ? json.title : name)
      let union = deepMergeAll(module, title, json, schemas)
      union.title = title

      delete union['$ref']

      return getSchemaShapeInfo(union, module, schemas, { name, prefix, merged: true, level, title, summary, descriptions, destination, section, enums })
    }
    else if (json.type === 'array') {
      let j
      if (Array.isArray(json.items)) {
        //TODO
        const IsHomogenous = arr => new Set(arr.map( item => item.type ? item.type : typeof item)).size === 1
        if (!IsHomogenous(json.items)) {
          throw 'Heterogenous Arrays not supported yet'
        }
        j = json.items[0]
      }
      else {
        j = json.items
      }
      shape += getSchemaShapeInfo(j, module, schemas, { name: j.title || name, prefix, merged, level, title, summary, descriptions, destination, section, enums })

      if (!isCPP) {
        let info = getSchemaTypeInfo(module, j, j.title || name, schemas, prefix, {level : level, descriptions: descriptions, title: true})

        if (info.type && info.type.length > 0) {
          let type = getArrayElementSchema(json, module, schemas, info.name)
          let arrayName = capitalize(name) + capitalize(type.type)
          let objName = getTypeName(info.namespace, arrayName, prefix)
          let tName = objName + 'Array'
          let moduleName = info.namespace
          info.json.namespace = info.namespace
          let moduleProperty = getJsonTypeInfo(module, json, json.title || name, schemas, prefix)
          let subModuleProperty = getJsonTypeInfo(module, j, j.title, schemas, prefix)
          let t = ''
          if (level === 0) {
            t += description(capitalize(info.name), json.description) + '\n'
            t += '\n' + (isHeader ? getObjectHandleManagement(tName) : getObjectHandleManagementImpl(tName, moduleProperty.type))
          }
          t += '\n' + (isHeader ? getArrayAccessors(objName, tName, info.type) : getArrayAccessorsImpl(objName, moduleProperty.type, (tName + 'Handle'), subModuleProperty.type, '', info.type, info.json))
          shape += '\n' + t
        }
      }
    }
    else {
      shape += '\n' + getSchemaType(module, json, name, schemas, prefix, {level: level, descriptions: descriptions})
    }
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

function getJsonType(schema = {}, module = {}, { name = '', prefix = '', descriptions = false, level = 0 } = {}) {
  let info = getJsonTypeInfo(module, schema, name, module['x-schemas'], prefix, { descriptions: descriptions, level: level })
  return info.type
}

function getJsonTypeInfo(module = {}, json = {}, name = '', schemas, prefix = '', {descriptions = false, level = 0} = {}) {

  if (json.schema) {
    json = json.schema
  }

  let info = {}
  info["deps"] = new Set() //To avoid duplication of local ref definitions
  info["type"] = []

  if (json['$ref']) {
    if (json['$ref'][0] === '#') {
      //Ref points to local schema
      //Get Path to ref in this module and getSchemaType
      let definition = getPath(json['$ref'], module, schemas)
      let tName = definition.title || json['$ref'].split('/').pop()

      let schema = module
      if (json['$ref'].includes('x-schemas')) {
        schema = (getRefModule(json['$ref'].split('/')[2]))
      }

      const res = getJsonTypeInfo(schema, definition, tName, schemas, '', {descriptions, level})
      info.deps = res.deps
      info.type = res.type
      return info
    }
  }
  else if (json.const) {
    info.type = getJsonNativeType(json)
    return info
  }
  else if (json['x-method']) {
    return info
    //throw "x-methods not supported yet"
  }
  else if (json.additionalProperties && (typeof json.additionalProperties === 'object')) {
      //This is a map of string to type in schema
      //Get the Type
      let type = getJsonTypeInfo(module, json.additionalProperties, name, schemas, prefix)
      if (type.type && type.type.length > 0) {
          info.type = 'WPEFramework::Core::JSON::VariantContainer';
          return info
      }
      else {
        console.log(`WARNING: Type undetermined for ${name}`)
      }
    }
  else if (json.type === 'string' && json.enum) {
    //Enum
    let t = 'WPEFramework::Core::JSON::EnumType<' + (json.namespace ? json.namespace : getModuleName(module)) + '_' + (getEnumName(name, prefix)) + '>'
    info.type.push(t)
    return info
  }
  else if (Array.isArray(json.type)) {
    let type = json.type.find(t => t !== 'null')
    let sch = JSON.parse(JSON.stringify(json))
    sch.type = type
    return getJsonTypeInfo(module, sch, name, schemas, prefix )
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
    res = getJsonTypeInfo(module, items, items.name || name, schemas, prefix)
    info.deps = res.deps
    info.type.push(`WPEFramework::Core::JSON::ArrayType<${res.type}>`)

    return info
  }
  else if (json.allOf) {
    let title = json.title ? json.title : name
    let union = deepMergeAll(module, title, json, schemas)
    union['title'] = title

    delete union['$ref']
    return getJsonTypeInfo(module, union, '', schemas, '', {descriptions, level})
  }
  else if (json.oneOf) {
    info.type = getJsonNativeTypeForOpaqueString()
    return info
  }
  else if (json.patternProperties) {
    info.type = getJsonNativeTypeForOpaqueString()
    return info
  }
  else if (json.anyOf) {
    let mergedSchema = getMergedSchema(module, json, name, schemas)
    let prefixName = ((prefix.length > 0) && (!name.startsWith(prefix))) ? prefix : capitalize(name)
    info = getJsonTypeInfo(module, mergedSchema, name, schemas, prefixName, {descriptions, level})
  }
  else if (json.type === 'object') {
    if (hasProperties(json) !== true) {
      info.type = getJsonNativeTypeForOpaqueString()
    }
    else {
      let schema = getSchemaTypeInfo(module, json, name, module['x-schemas'], prefix)
      if (schema.namespace && schema.namespace.length > 0) {
        info.type.push(getJsonDataStructName(schema.namespace, json.title || name, prefix))
      }
    }
    return info
  }
  else if (json.type) {
    info.type = getJsonNativeType(json)
    return info
  }
  return info
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

const hasTag = (method, tag) => {
  return method.tags && method.tags.filter(t => t.name === tag).length > 0
}

const getTagName = (method, tag) => {
  return compose(
    reduce((acc, t, i, arr) => {
      acc = Array.isArray(t) ? t[0].name : t.name
      return acc
    }, ''),
    filter(t => t.name),
    map(filter(t => t.includes(tag))),
    (method) => method.tags
  )(method)
}

function isAnyofType(type, module) {
  let anyOfType = false
  if (type.schema) {
    if (type.schema.anyOf) {
      anyOfType = true
    }
    else {
      let schemaType = getSchemaType(module, type.schema, type.name, module['x-schemas'])
      if (schemaType.json && schemaType.json.anyOf) {
        if (!type.name && !type.title) {
           throw method + ": does not has both title and name"
        }
        anyOfType = true
      }
    }
  }
  return anyOfType
}

function isAnyofParamsAndResult(method, module) {
  let anyOfTypeParam = false
  method.params.every(param => {
    anyOfTypeParam = isAnyofType(param, module)
    return !anyOfTypeParam
  })
  anyOfTypeParam = (anyOfTypeParam == true) ? isAnyofType(method.result, module) : false
  return anyOfTypeParam
}

function validateParamsAndResult(method, module) {
  if (isAnyofParamsAndResult == true) {
    throw method.name + " : policy schema is not support, since it has anyOf type for both param(s) and result"
  }
}

const getParamType = (type) => {
    let res = {}
    if (type.json && (type.json.type === 'object') && (!type.json.properties) && (!type.json.additionalProperties)) {
      res = 'char*'
    }
    else {
      res = type.type
    }
    return res;
}

const getAnyOfSchema = (param, module, schemas, info, prefix = '') => {
  let anyOf = {}
  anyOf["schema"]
  anyOf["refSchema"] = ''
  let name = param.name

  if (param.schema.anyOf) {
    anyOf.schema = param.schema
  }
  else {
    let sch = param['$ref'] ? param['$ref'] : param.schema['$ref'] ? param.schema['$ref'] : null
    if (sch) {
      if (sch[0] !== '#') {
         anyOf.refSchema = getSchema(sch.split('#')[0], schemas) || module
      }
      let schema = getPath(sch, module, schemas)
      anyOf.schema = schema.anyOf ? schema : anyOf.schema
    }
  }
  if (anyOf && anyOf.schema) {
    info["anyOfParams"] = []
    for (const schema of anyOf.schema.anyOf) {
      if (!JSON.stringify(schema).includes('ListenResponse')) {
        module = anyOf.refSchema ? anyOf.refSchema : module
        let anyOfType = getSchemaTypeInfo(module, schema, schema.name || schema.title || name, schemas, prefix)
        if (anyOf.refSchema) {
          anyOfType["refSchema"] = getJsonTypeInfo(module, anyOf.refSchema, anyOf.refSchema.title, module['x-schemas'])
        }
      }
    }
  }
  return info;
}

function getParamsInfo(method, module, prefix = '') {
  let info = {}
  info["params"] = []

  method.params.forEach(param => {
    info = getAnyOfSchema(param, module, module['x-schemas'], info)
    if (info.anyOfParams === undefined) {
      let schemaType = getSchemaType(module, param.schema, param.name, module['x-schemas'])
      if (param.required !== undefined && schemaType) {
        let p = {}
        p["nativeType"] = getParamType(schemaType)
        p["jsonType"] = getJsonType(param.schema, module, {name: param.name})
        p["name"] = param.name
        p["required"] = param.required
        info.params.push(p)
      }
    }
  })
  if (method.result.schema) {
    info = getAnyOfSchema(method.result, module, module['x-schemas'], info, prefix)
    if (info.anyOfParams === undefined) {
      let result = getSchemaTypeInfo(module, method.result.schema, method.result.name || method.name, module['x-schemas'], prefix)
      let type = getParamType(result)
      info["result"] = (type === 'char*') ? getFireboltStringType(): type
    }
  }
  return info
}

function getMethodImpl(method, module) {

    let impl = ''

    validateParamsAndResult(method, module)
    let info = getParamsInfo(method, module)

    if (hasTag(method, 'property') ||
        hasTag(method, 'property:readonly') ||
        hasTag(method, 'property:immutable')) {

      let resultType = method.result && getSchemaType(method.result.schema, module, { title: true, name: method.result.name, resultSchema: true}) || ''
      let resultJsonType = method.result && getJsonType(method.result.schema, module, {name: method.result.name}) || ''
      let tag = getTagName(method, 'property')
      switch(tag) {
      case 'property':
        impl += getPropertySetterImpl(method, module, resultType, resultJsonType, Object.assign({}, info))
      case 'property:readonly':
        impl += getPropertyEventCallbackImpl(method,  module, resultType, resultJsonType, Object.assign({}, info))
        impl += getPropertyEventImpl(method,  module, resultType, resultJsonType, Object.assign({}, info))
      case 'property:immutable':
        impl += getPropertyGetterImpl(method,  module, resultType, resultJsonType, Object.assign({}, info))
        break;
      default:
        console.log(`WARNING invalid tag: ${tag} for method ${method.name}`)
        break;
      }
    }

    return impl
}

export default {
    getMethodSignature,
    getMethodSignatureParams,
    getSchemaShape,
    getSchemaType,
    getJsonType,
    getMethodImpl
}
