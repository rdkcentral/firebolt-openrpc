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
import { getObjectHandleManagementImpl, getPropertyAccessorsImpl } from './src/types/ImplHelpers.mjs'
import { getJsonContainerDefinition } from './src/types/JSONHelpers.mjs'

function getMethodSignature(method, module, { destination, isInterface = false }) {
    const extraParam = '${method.result.type}* ${method.result.name}'

    const prefix = method.tags.find(t => t.name.split(":")[0] === "property") ? "Get" : ""

    return 'uint32_t ${info.title}_' + prefix + '${method.Name}(' + extraParam + ')'
}

function getMethodSignatureParams(method, module, { destination }) {
    return method.params.map(param => param.name + (!param.required ? '?' : '') + ': ' + getSchemaType(param.schema, module, { title: true, destination })).join(', ')
}

const safeName = prop => prop.match(/[.+]/) ? '"' + prop + '"' : prop

function getSchemaType(schema, module, { name, destination, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {
    let type = ''
    let theTitle = schema.title || name || ('UnamedSchema' + (Math.floor(Math.random() * 100)))

    if (schema['x-method']) {
        console.log(`WARNING UNHANDLED: x-method in ${theTitle}`)
        //throw "x-methods not supported yet"
    }

    if (schema['$ref']) {
        if (schema['$ref'][0] === '#') {
            //Ref points to local schema 
            //Get Path to ref in this module and getSchemaType
            let definition = getPath(schema['$ref'], module)
            let tName = definition.title || schema['$ref'].split('/').pop()
            return getSchemaType(definition, module, { name: tName, destination, link, title, code, asPath, event, expandEnums, baseUrl })
        }
    }
    else if (schema.const) {
        type = getNativeType(schema)
        return type
    }
    else if (schema.type === 'string' && schema.enum) {
        //Enum
        let typeName = getTypeName(getModuleName(module), theTitle)
        return typeName
    }
    else if (Array.isArray(schema.type)) {
        let type = schema.type.find(t => t !== 'null')
        console.log(`WARNING UNHANDLED: type is an array containing ${schema.type}`)
    }
    else if (schema.type === 'array' && schema.items) {
        let res
        if (Array.isArray(schema.items)) {
            //TODO
            const IsHomogenous = arr => new Set(arr.map(item => item.type ? item.type : typeof item)).size === 1
            if (!IsHomogenous(schema.items)) {
                throw 'Heterogenous Arrays not supported yet'
            }
            res = getSchemaType(schema.items[0], module, { destination, link, title, code, asPath, event, expandEnums, baseUrl })
        }
        else {
            // grab the type for the non-array schema
            res = getSchemaType(schema.items, module, { destination, link, title, code, asPath, event, expandEnums, baseUrl })
        }

        if (!schema.title && !name) {
            console.log(`WARNING: generated name for ${module.info.title} schema w/ no title: ${theTitle}`)
            console.dir(schema)
        }

        let n = getTypeName(getModuleName(module), theTitle)
        return n + 'ArrayHandle'
    }
    else if (schema.allOf) {
        let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x)])
        if (theTitle) {
            union['title'] = theTitle
        }
        delete union['$ref']
        return getSchemaType(union, module, { destination, link, title, code, asPath, event, expandEnums, baseUrl })
    }
    else if (schema.oneOf || schema.anyOf) {
        return type
        //TODO
    }
    else if (schema.type === 'object') {
        if (!schema.title && !name) {
            console.log(`WARNING: generated name for ${module.info.title} schema w/ no title: ${theTitle}`)
            console.dir(schema)
        }
        return getTypeName(getModuleName(module), theTitle) + 'Handle'
        //TODO
    }
    else if (schema.type) {
        type = getNativeType(schema)
        return type
    }

    // TODO: deal with dependencies
    return type
}

//function getSchemaShape(schema = {}, module = {}, { name = '', level = 0, title, summary, descriptions = true, destination, enums = true } = {})
//  function getSchemaType()
function getSchemaShape(schema, module, { name = '', level = 0, title, summary, descriptions = true, destination = '', section = '', enums = true } = {}) {
    const isHeader = destination.endsWith(".h")
    const isCPP = (destination.endsWith(".cpp") && section !== 'accessors')

    schema = JSON.parse(JSON.stringify(schema))

    let shape = ''

    name = schema.title || name

    if (!name) {
        console.log(`WARNING: schema without a name in ${module.info.title}`)
        return shape
    }

    if (schema['$ref']) {
        if (schema['$ref'][0] === '#') {
            //Ref points to local schema 
            //Get Path to ref in this module and getSchemaType

            const schema = getPath(schema['$ref'], module)
            const tname = name || schema['$ref'].split('/').pop()
            return getSchemaShape(schema, module, { name: tname, descriptions: descriptions, level: level })
        }
    }
    //If the schema is a const,
    else if (schema.hasOwnProperty('const') && !isCPP) {
        if (level > 0) {

            let t = description(name, schema.description)
            typeName = getTypeName(getModuleName(module), name)
            t += (isHeader ? getPropertyAccessors(typeName, capitalize(name), typeof schema.const, { level: level, readonly: true, optional: false }) : getPropertyAccessorsImpl(typeName, capitalize(name), getJsonType(schema, module, { level, name }), typeof schema.const, { level: level, readonly: true, optional: false }))
            shape += '\n' + t
        }
    }
    else if (schema.type === 'object') {
        if (!name) {
            console.log(`WARNING: unnamed schema in ${module.info.title}.`)
            console.dir(schema)
            shape = ''
        }
        else if (schema.properties) {
            let tName = getTypeName(getModuleName(module), name)
            let c_shape = description(name, schema.description)
            let cpp_shape = ''
            c_shape += '\n' + (isHeader ? getObjectHandleManagement(tName) : getObjectHandleManagementImpl(tName, getJsonType(schema, module, { name })))
            Object.entries(schema.properties).forEach(([pname, prop]) => {
                c_shape += '\n' + description(pname, prop.description)
                let res
                if (prop.type === 'array') {
                    if (Array.isArray(prop.items)) {
                        //TODO
                        const IsHomogenous = arr => new Set(arr.map(item => item.type ? item.type : typeof item)).size === 1
                        if (!IsHomogenous(prop.items)) {
                            throw 'Heterogenous Arrays not supported yet'
                        }
                        res = getSchemaType(prop.items[0], module, { name: pname, level: level, descriptions: descriptions, title: true })
                    }
                    else {
                        // grab the type for the non-array schema
                        res = getSchemaType(prop.items, module, { name: pname, level: level, descriptions: descriptions, title: true })
                    }
                    if (res && res.length > 0) {
                        let n = tName + '_' + capitalize(pname || prop.title)
                        let def = getArrayAccessors(n + 'Array', res)
                        c_shape += '\n' + def
                    }
                    else {
                        console.log(`a. WARNING: Type undetermined for ${name}:${pname}`)
                    }
                } else {
                    res = getSchemaType(prop, module, { name: pname, descriptions: descriptions, level: level + 1, title: true })
                    if (res && res.length > 0) {
                        c_shape += '\n' + (isHeader ? getPropertyAccessors(tName, capitalize(pname), res, { level: level, readonly: false, optional: isOptional(pname, schema) }) : getPropertyAccessorsImpl(tName, capitalize(pname), getJsonType(prop, module, { level, name }), res, { level: level, readonly: false, optional: isOptional(pname, schema) }))
                    }
                    else {
                        console.log(`b. WARNING: Type undetermined for ${name}:${pname}`)
                    }
                }
            })
            cpp_shape += getJsonContainerDefinition(tName, Object.entries(schema.properties).map(([name, prop]) => ({ name, type: getJsonType(prop, module) })))

            if (isCPP) {
                shape += '\n' + cpp_shape
            }
            else {
                shape += '\n' + c_shape
            }
        }
        else if (schema.propertyNames && schema.propertyNames.enum) {
            //propertyNames in object not handled yet
        }
        else if (schema.additionalProperties && (typeof schema.additionalProperties === 'object') && !isCPP) {
            //This is a map of string to type in schema
            //Get the Type
            let type = getSchemaType(schema.additionalProperties, module, { name: name })
            if (type && type.length > 0) {
                let tName = getTypeName(getModuleName(module), name)
                // type.deps.forEach(dep => structure.deps.add(dep))
                let t = description(name, schema.description)
                t += '\n' + (isHeader ? getObjectHandleManagement(tName) : getObjectHandleManagementImpl(tName, getJsonType(schema, module, { name })))
                t += getMapAccessors(getTypeName(getModuleName(module), name), type, { descriptions: descriptions, level: level })
                shape += '\n' + t
            }
            else {
                console.log(`c. WARNING: Type undetermined for ${name}`)
            }
        }
        else if (schema.patternProperties) {
            console.log(`WARNING: patternProperties not supported yet...`)
            //        throw "patternProperties are not supported by Firebolt"
        }
    }
    else if (schema.anyOf) {

    }
    else if (schema.oneOf) {

    }
    else if (schema.allOf) {
        let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module) || x : x)])
        if (name) {
            union['title'] = name
        }
        delete union['$ref']
        return getSchemaShape(union, module, { name, level, title, summary, descriptions, destination, section, enums })

    }
    else if (schema.type === 'array') {
        let res = getSchemaType(schema, module, { name, level: 0, descriptions: descriptions })
        //      res.deps.forEach(dep => structure.deps.add(dep))
    }
    else {
        let res = getSchemaType(schema, module, { name, level: level, descriptions: descriptions })
        //      res.deps.forEach(dep => structure.deps.add(dep))
    }
    //    console.dir(structure.deps)
    return shape
}

//  function getJsonType(schema, module, { destination, link = false, title = false, code = false, asPath = false, event = false, expandEnums = true, baseUrl = '' } = {}) {

const getJsonDataStructName = (modName, name) => `${capitalize(modName)}::${capitalize(name)}`

const getJsonNativeType = json => {
    let type
    let jsonType = json.const ? typeof json.const : json.type

    if (jsonType === 'string') {
        type = 'WPEFramework::Core::JSON::String'
    }
    else if (jsonType === 'number' || json.type === 'integer') { //Lets keep it simple for now
        type = 'WPEFramework::Core::JSON::Number'
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

    let type = ''

    if (schema['$ref']) {
        if (schema['$ref'][0] === '#') {
            //Ref points to local schema 
            //Get Path to ref in this module and getSchemaType
            let definition = getPath(schema['$ref'], module)
            let tName = definition.title || schema['$ref'].split('/').pop()
            return getJsonType(definition, module, { name: tName, descriptions: descriptions, level: level })
        }
    }
    else if (schema.const) {
        return getJsonNativeType(schema)
    }
    else if (schema['x-method']) {
        console.log(`WARNING: x-methods are not supported yet...`)
        return type
        //throw "x-methods not supported yet"
    }
    else if (schema.type === 'string' && schema.enum) {
        //Enum
        let t = getSchemaType(schema, module, { name })
        return 'WPEFramework::Core::JSON::EnumType<::' + t + '>'
    }
    else if (Array.isArray(schema.type)) {
        let type = schema.type.find(t => t !== 'null')
        console.log(`WARNING UNHANDLED: type is an array containing ${schema.type}`)
    }
    else if (schema.type === 'array' && schema.items) {
        let res
        if (Array.isArray(schema.items)) {
            //TODO
            const IsHomogenous = arr => new Set(arr.map(item => item.type ? item.type : typeof item)).size === 1
            if (!IsHomogenous(schema.items)) {
                throw 'Heterogenous Arrays not supported yet'
            }
            res = getJsonType(schema.items[0], module, { name: '' })
        }
        else {
            // grab the type for the non-array schema
            res = getJsonType(schema.items, module, { name: '' })
        }

        return `WPEFramework::Core::JSON::ArrayType<${res}>`
    }
    else if (schema.allOf) {
        let union = deepmerge.all([...schema.allOf.map(x => x['$ref'] ? getPath(x['$ref'], module, schemas) || x : x)])
        if (schema.title) {
            union['title'] = schema.title
        }
        else {
            union['title'] = name
        }
        delete union['$ref']
        return getJsonType(union, module, { name: '', level, descriptions })
    }
    else if (schema.oneOf || schema.anyOf) {
        return type
        //TODO
    }
    else if (schema.type === 'object') {
        if (!schema.title && !name) {
            console.log(`WARNING: schema with no name`)
            console.dir(schema)
            return 'Unknown'
        }
        return getJsonDataStructName(getModuleName(module), schema.title || name)
        //TODO
    }
    else if (schema.type) {
        return getJsonNativeType(schema)
    }
    return type
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