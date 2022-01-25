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

import crocksHelpers from 'crocks/helpers/index.js'
const { getPathOr } = crocksHelpers

import { fsWriteFile, fsReadFile, bufferToString, getFilename, getDirectory, getLinkFromRef } from '../../shared/helpers.mjs'
import { getMethodSignature, getMethodSignatureParams ,getSchemaType, getSchemaShape } from '../../shared/typescript.mjs'
import { getPath, getSchema, getExternalSchemaPaths, getSchemaConstraints, isDefinitionReferencedBySchema, hasTitle, localizeDependencies } from '../../shared/json-schema.mjs'
import { getTemplate, getAllTemplateNames } from '../../shared/template.mjs'
import path from 'path'
import fs from 'fs'

var pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

/**
 * TODO
 * - add See also, or enum input for schemas (e.g. ProgramType used by Discovery)
 */

// current json schema
let currentSchema
let outputDir
let document
let _options = {asPath: false, baseUrl: '' }

const version = {
    major: 0,
    minor: 0,
    patch: 0,
    readable: '0.0.0'
}

const setVersion = (v) => {
    version.major = v.major
    version.minor = v.minor
    version.patch = v.patch
    version.readable = v.major + '.' + v.minor + '.' + v.patch
}

const setOutput = o => outputDir = o
const generateMacros = j => {
    currentSchema = j
    if (currentSchema.info) {
        _options.baseUrl = _options.asPath ? '../' : './'
    }
    else {
        _options.baseUrl = _options.asPath ? '../../' : './'
    }
}

const setOptions = o => {
    _options = o
}

const generateDocs = j => {
    document = getTemplate(j.info ? 'index.md' : 'schema.md')
    document = insertMacros(document, j)
}

const writeDocumentation = _ => fsWriteFile(path.join(outputDir, getDirectory(currentSchema, _options.asPath), getFilename(currentSchema, _options.asPath) + '.md'), document)
const insertAggregateMacrosOnly = () => false

const getTitle = json => json.info ? json.info.title :json.title

function hasTag (method, tag) {
    return method.tags && method.tags.filter(t => (t.name === tag)).length > 0
}

export {
    setOptions,
    setVersion,
    setOutput,
    generateMacros,
    generateDocs,
    writeDocumentation,
    insertAggregateMacrosOnly
}

function insertMacros(data, json) {
    let match, regex

    if (json.methods) {
        regex = /\$\{methods\}/
        while (match = data.match(regex)) {
            let methods = ''
            json.methods.forEach(method => {
                if (!method.tags || (!method.tags.find(t => t.name === 'event'))) {
                    methods += insertMethodMacros(match[0], method, getTitle(json))
                }
            })
            data = data.replace(regex, methods)
        }

        regex = /\$\{events\}/
        if (match = data.match(regex)) {
            let events = ''
            json.methods.forEach(method => {
                if (method.tags && method.tags.find(t => t.name === 'event')) {
                    events += insertMethodMacros(match[0], method, getTitle(json))
                }
            })
            data = data.replace(regex, events)
        }

        regex = /[\# \t]*?\$\{event\.[a-zA-Z]+\}.*?\$\{end.event\}/s
        while (match = data.match(regex)) {
            data = data.replace(regex, insertEventMacros(match[0], json.methods, getTitle(json)))
        }

        let js = false
        json.methods.forEach(m => {
            if (!m.tags || !m.tags.map(t => t.name).includes('rpc-only')) {
                js = true
            }
        })

        // get rid of javascript-specific template contents if there is no javascript method in this module
        if (!js) {
            data = data.replace(/\$\{if\.javascript\}.*?\{end\.if\.javascript\}/gms, '')
        }

    }

    let schemas, prefix

    if (json.components && json.components.schemas && Object.values(json.components.schemas).length) {
        schemas = json.components.schemas
        prefix = '#/components/schemas/'
    }
    else if (json.definitions && Object.values(json.definitions).length) {
        schemas = json.definitions
        prefix = '#/definitions/'
    }

    if (schemas) {
        regex = /[\# \t]*?\$\{schema\.[a-zA-Z]+\}.*?\$\{end.schema\}/s
        while (match = data.match(regex)) {
            data = data.replace(regex, insertSchemaMacros(match[0], schemas, getTitle(json)))
        }

        let schemas_toc = []
        Object.entries(schemas).forEach(([n, v]) => {
            if (true || isDefinitionReferencedBySchema(prefix + n, json)) {
                let str = v.title ? v.title : n
                str = '    - [' + str + '](#' + str.toLowerCase() + ')'
                schemas_toc.push(str)
            }
        })

        schemas_toc = schemas_toc.join('\n')

        data = data.replace(/\$\{toc.schemas\}/g, schemas_toc)

    }
    else {
        data = data.replace(/\$\{if\.schemas\}.*?\{end\.if\.schemas\}/gms, '')
    }

    if (json.methods) {
        data = data
            .replace(/\$\{toc.methods\}/g, json.methods.filter(m => !m.name.match(/^on[A-Z]/)).map(m => '    - [' + m.name + '](#' + m.name.toLowerCase() + ')').join('\n'))
            .replace(/\$\{toc.events\}/g, json.methods.filter(m => m.name.match(/^on[A-Z]/)).map(m => '    - [' + m.name[2].toLowerCase() + m.name.substr(3) + '](#' + m.name.substr(2).toLowerCase() + ')').join('\n'))
    }

    data = data
        .replace(/\$\{module}/g, getTitle(json).toLowerCase() + '.json')
        .replace(/\$\{info.title}/g, getTitle(json))
        .replace(/\$\{pkg.name}/g, pkg.name)
        .replace(/\$\{info.version}/g, version.readable)
        .replace(/\$\{info.description}/g, json.info ? json.info.description : '')

    data = data.replace(/\$\{[a-zA-Z.]+\}\s*\n?/g, '') // remove left-over macros

    return data
}

function insertMethodMacros(data, method, module) {
    let result = ''

    if (!data) return ''

    let template = method.tags && method.tags.map(t=>t.name).find(t => getAllTemplateNames().includes('methods/' + t + '.md')) || 'default'
    if (hasTag(method, 'property') || hasTag(method, 'property:readonly') || hasTag(method, 'property:immutable')) {
        template = 'polymorphic-property'
    }
    data = getTemplate(`methods/${template}.md`)
    data = iterateSignatures(data, method, module)

    if (method.params.length === 0) {
        data = data.replace(/\$\{if\.params\}.*?\{end\.if\.params\}/gms, '')
    }
    if (!method.examples || method.examples.length === 0) {
        data = data.replace(/\$\{if\.examples\}.*?\{end\.if\.examples\}/gms, '')
    }
    if (!method.description) {
        data = data.replace(/\$\{if\.description\}.*?\{end\.if\.description\}/gms, '')
    }

    let method_data = data

    const deprecated = method.tags && method.tags.find( t => t.name === 'deprecated')
    if (deprecated ) {
        let alternative = deprecated['x-alternative'] || ''
        let since = deprecated['x-since'] || ''

        if (alternative && alternative.indexOf(' ') === -1) {
          alternative = `Use \`${alternative}\` instead.`
        }
    
        method_data = method_data
            .replace(/\$\{method.description\}/g, `This method is **deprecated**` + (since ? ` since version ${since}. ` : '. ') + `${alternative}\n\n\$\{method.description\}`)
    }

    method_data = method_data
        .replace(/\$\{method.name\}/g, method.name)
        .replace(/\$\{event.name\}/g, method.name.length > 3 ? method.name[2].toLowerCase() + method.name.substr(3): method.name)
        .replace(/\$\{method.summary\}/g, method.summary)
        .replace(/\$\{method.description\}/g, method.description || method.summary)
        .replace(/\$\{module\}/g, module)

    method_data = method_data.replace(/\$\{.*?method.*?\}\s*\n?/g, '')

    result += method_data + '\n'

    return result
}

function generatePropertySignatures (m) {
    let signatures = [m]
    if (hasTag(m, 'property') && !hasTag(m, 'property:immutable') && !hasTag(m, 'property:readonly')) {
        signatures.push({
            name: m.name,
            summary: 'Set value for ' + m.summary,
            // setter takes the getters result
            params: [
                {
                    ...m.result,
                    name: 'value',
                    required: true
                }
            ],
            result: {
                name: "response",
                summary: "",
                schema: {
                  const: null
                }
            },
            examples: [
                {
                    name: "",
                    params: [
                      {
                        name: "value",
                        value: m.examples[0].result.value
                      }
                    ],
                    result: {
                      name: "Default Result",
                      value: null
                    }
                  }
            ]
        })
    } else {
        signatures.push(null)
    }
    if ((hasTag(m, 'property') || hasTag(m, 'property:readonly')) && !hasTag(m, 'property:immutable')) {
        signatures.push({
            name: m.name,
            summary: 'Subscribe to value for ' + m.summary,
            tags: [{
                name: 'property-subscribe'
            }],
            params: [
                {
                    ...m.result,
                    required: true
                }
            ],
            result: {
                name: "listenerId",
                summary: "",
                schema: {
                    type: 'string'
                }
            },
            examples: m.examples
        })
    } else {
        signatures.push(null)
    }
    return signatures
}

function iterateSignatures(data, method, module) {
    // we're hacking the schema here... make a copy!
    method = JSON.parse(JSON.stringify(method))
    let signatures = [method]
    if (hasTag(method, 'property') || hasTag(method, 'property:readonly') || hasTag(method, 'property:immutable')) {
        signatures = generatePropertySignatures(method)
    }
    
    if (method.tags && method.tags.find(t => t.name === 'polymorphic-pull')) {
        // copy the method for the pull version
        const pull = JSON.parse(JSON.stringify(method))
        
        // change the original to be 'push'
        method.tags.find(t => t.name === 'polymorphic-pull').name = ''

        // change result of pull-method to be the params of the original push-method
        const resultRef = method.name[0].toUpperCase() + method.name.substr(1) + 'Result'
        pull.result = {
            "name": "results",
            "schema": {
                "$ref": `#/components/schemas/${resultRef}`
            }
        }

        // Find the parameters for the pull method
        const pullEventMethod = currentSchema.methods.find(m => m.name.toLowerCase() === 'onpull' + method.name.toLowerCase())
        const pullParameters = localizeDependencies(getPath('#/components/schemas/' + method.name[0].toUpperCase() + method.name.substr(1) + 'Parameters', currentSchema), currentSchema) || getExternalPath('#/definitions/' + method.name[0].toUpperCase() + method.name.substr(1), true)
        
        if (pullParameters) {
            pull.params = [Object.assign({ schema: pullParameters }, { name: 'parameters', required: true, summary: pullEventMethod.result.summary })]
        }
        else {
            console.log('WARNING: could not find '+method.name[0].toUpperCase() + method.name.substr(1) + 'Parameters schema')
            process.exit(1)
        }

        if (pull.examples) {
            pull.examples.forEach(example => {
                example.name = example.name + ' (Pull)'
                example.result = {
                    "name": "result",
                    "value": {}
                }
                if (example.params) {
                    example.params.forEach(param => {
                        example.result.value[param.name] = param.value
                    })
                }
            })
        }
        signatures = [pull, ...signatures]
    }
    else if (method.tags && method.tags.find(t => t.name === 'event')) {
        const possibleResults = method.result.schema.oneOf || method.result.schema.anyOf
        if (possibleResults && possibleResults.length == 2) {
            method.result.schema = possibleResults.find(s => s['$ref'] !== "https://meta.comcast.com/firebolt/types#/definitions/ListenResponse")
        }
        else {
            console.log(`\nERROR: ${module}.${method.name} does not have two return types: both 'ListenResponse' and an event-specific payload\n`)
            process.exit(1)
        }
    }

    let regex, match, block

    let i = 0
    signatures.forEach(sig => {
        i++
        regex = /\$\{method\.[0-9]\}(.*?)\$\{(end\.method|method\.[0-9])\}/s
        match = data.match(regex)

        if (!match) {
            regex = /(.*)/s
            match = data.match(regex)
        }

        let block = sig == null ? '' : insertSignatureMacros(match[1], sig, module)
        data = data.replace(regex, block)
    })

    return data
}

function insertSignatureMacros(block, sig, module) {
    if (sig.params.length === 0) {
        block = block.replace(/\$\{if\.params\}.*?\{end\.if\.params\}/gms, '')
    }
    if (!sig.examples || sig.examples.length === 0) {
        block = block.replace(/\$\{if\.examples\}.*?\{end\.if\.examples\}/gms, '')
    }

    if (sig.tags && sig.tags.map(t => t.name).includes('rpc-only')) {
        block = block.replace(/\$\{if\.javascript\}.*?\{end\.if\.javascript\}/gms, '')
    }

    let regex = /[\# \t]*?\$\{example\.[a-zA-Z]+\}.*?\$\{end.example\}/s
    let match = block.match(regex)
 
    let exampleBlock = insertExampleMacros(match[0], sig, module)

    block = block.replace(regex, exampleBlock)

    let lines = block.split('\n')

    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].match(/\$\{method\.param\.[a-zA-Z]+\}/)) {
            let line = lines[i]
            lines.splice(i, 1)
            sig.params.forEach((param) => { lines.splice(i++, 0, insertParamMacros(line, param)) })
        }
    }

    block = lines.join('\n')

    block = block.replace(/\$\{method.signature\}/g, getMethodSignature(currentSchema, sig, { isInterface: false }))
        .replace(/\$\{method.params\}/g, getMethodSignatureParams(currentSchema, sig))
        .replace(/\$\{method.result.name\}/g, sig.result.name)
        .replace(/\$\{method.result.summary\}/g, sig.result.summary)
        .replace(/\$\{method.result.type\}/g, getSchemaType(currentSchema, sig.result, {title: true, asPath: _options.asPath, baseUrl: _options.baseUrl}))
        .replace(/\$\{method.result\}/g, getSchemaTypeTable(currentSchema, sig.result, { description: sig.result.summary, title: true, asPath: _options.asPath, baseUrl: _options.baseUrl}))

    return block
}

function insertSchemaMacros(data, schemas, module) {
    let result = ''
    const prefix = currentSchema.info ? '#/components/schemas/' : '#/definitions/'

    Object.entries(schemas).forEach(([name, schema]) => {
        if (true || isDefinitionReferencedBySchema(prefix + name, (currentSchema.methods ? currentSchema.methods : currentSchema)) || schema.title) {

            let lines = data
            if (!schema.examples || schema.examples.length === 0) {
                lines = lines.replace(/\$\{if\.examples\}.*?\{end\.if\.examples\}/gms, '')
            }
            if (!schema.description) {
                lines = lines.replace(/\$\{if\.description\}.*?\{end\.if\.description\}/gms, '')
            }
            lines = lines.split('\n')

            let schema_data = lines.join('\n')
                .replace(/\$\{schema.title\}/, (schema.title || name))
                .replace(/\$\{schema.description\}/, schema.description)
                .replace(/\$\{schema.shape\}/, getSchemaShape(currentSchema, schema, name))

            if (schema.examples) {
                schema_data = schema_data.replace(/\$\{schema.example\}/, schema.examples.map(ex => JSON.stringify(ex, null, '  ')).join('\n\n'))
            }

            let seeAlso = getExternalSchemaLinks(schema, _options)
            if (seeAlso) {
                schema_data = schema_data.replace(/\$\{schema.seeAlso\}/, '\n\n' + seeAlso)
            }
            else {
                schema_data = schema_data.replace(/.*\$\{schema.seeAlso\}/, '')
            }

            schema_data = schema_data.replace(/\$\{.*?schema.*?\}\s*\n?/g, '')

            result += schema_data + '\n'
        }
    })

    return result
}

function insertEventMacros(data, methods, module) {
    let result = ''

    methods.forEach(method => {
        if (!method.name.match(/^on[A-Za-z]+/)) {
            return
        }
        let lines = data
        if (method.params.length === 0) {
            lines = lines.replace(/\$\{if\.params\}.*?\{end\.if\.params\}/gms, '')
        }
        if (!method.examples || method.examples.length === 0) {
            lines = lines.replace(/\$\{if\.examples\}.*?\{end\.if\.examples\}/gms, '')
        }
        if (!method.description) {
            lines = lines.replace(/\$\{if\.description\}.*?\{end\.if\.description\}/gms, '')
        }
        lines = lines.split('\n')

        let method_data = lines.join('\n')
            .replace(/\$\{event.name\}/, method.name[2].toLowerCase() + method.name.substr(3))
            .replace(/\$\{event.summary\}/, method.summary)
            .replace(/\$\{event.description\}/, method.description)
            .replace(/\$\{event.result.name\}/, method.result.name)
            .replace(/\$\{event.result.summary\}/, method.result.summary)
            .replace(/\$\{event.result.type\}/, getSchemaTypeTable(currentSchema, method.result, { event: true, description: method.result.summary, asPath: _options.asPath, baseUrl: _options.baseUrl })) //getType(method.result, true))

        let match, regex = /[\# \t]*?\$\{example\.[a-zA-Z]+\}.*?\$\{end.example\}/s
        while (match = method_data.match(regex)) {
            method_data = method_data.replace(regex, insertExampleMacros(match[0], method, module))
        }

        method_data = method_data.replace(/\$\{.*?method.*?\}\s*\n?/g, '')

        result += method_data + '\n'
    })

    return result
}

function insertParamMacros(data, param) {
    let constraints = getSchemaConstraints(param, currentSchema)
    let type = getSchemaType(currentSchema, param, { code: true, link: true, title: true, asPath: _options.asPath, baseUrl: _options.baseUrl })

    if (constraints && type) {
        constraints = '<br/>' + constraints
    }

    return data
        .replace(/\$\{method.param.name\}/, param.name)
        .replace(/\$\{method.param.summary\}/, param.summary || '')
        .replace(/\$\{method.param.required\}/, param.required || 'false')
        .replace(/\$\{method.param.type\}/, type) //getType(param))
        .replace(/\$\{method.param.constraints\}/, constraints) //getType(param))
}

function insertExampleMacros(data, method, module) {
    let result = ''

    if (method.tags && method.tags.map(t => t.name).includes('rpc-only')) {
        data = data.replace(/\$\{if\.javascript\}.*?\{end\.if\.javascript\}/gms, '')
    }

    method.examples && method.examples.forEach(example => {
        
        let params = example.params.map(p => JSON.stringify(p.value, null, '  ')).join(',\n').split('\n').join('\n' + ' '.repeat(module.length + method.name.length + 2))
        
        let example_data = data
            .replace(/\$\{example.title\}/, example.name)
            .replace(/\$\{example.javascript\}/, generateJavaScriptExample(example, method, module))
            .replace(/\$\{example.result\}/, generateJavaScriptExampleResult(example, method, module))
            .replace(/\$\{example.params\}/, params)
            .replace(/\$\{example.jsonrpc\}/, generateRPCExample(example, method, module))
            .replace(/\$\{example.response\}/, generateRPCExampleResult(example, method, module))
            .replace(/\$\{callback.jsonrpc\}/, generateRPCCallbackExample(example, method, module))
            .replace(/\$\{callback.response\}/, generateRPCCallbackExampleResult(example, method, module))

        result += example_data
    })

    result = result.replace(/\$\{.*?example.*?\}\s*\n?/g, '')

    return result
}

function getSchemaTypeTable(module, json, options) {
    let type = getSchemaType(module, json, options)
    let summary = json.summary

    if (json.schema) {
        json = json.schema
    }

    if (type === 'object' && json.properties) {
        let type = ''

        if (summary) {
            type = summary + '\n\n'
        }

        type += '| Field | Type | Description |\n'
            + '| ----- | ---- | ----------- |\n'

        Object.entries(json.properties).forEach(([name, prop]) => {
            type += `| \`${name}\` | ${getSchemaType(module, prop, { link: true, code: true, event: options.event, asPath: options.asPath, baseUrl: _options.baseUrl }).replace('|', '\\|')} | ${prop.description || ''} |\n`
        })

        return type
    }
    else {
        let type = '| Type | Description |\n'
            + '| ---- | ----------- |\n'

        const obj = json.oneOf ? json.oneOf[0] : json
        const path = obj['$ref']
        const ref = path ? getPath(path, module) : json
    
        type += `| ${getSchemaType(module, json, { code: true, link: true, event: options.event, title: true, asPath: options.asPath, baseUrl: _options.baseUrl }).replace('|', '\\|')} | ${json.description || ref.description || summary || ''} |\n`

        return type

    }
}

function getExternalSchemaLinks(json) {
    const seen = {}

    const isModule = currentSchema.info

    let links = getExternalSchemaPaths(json)
        .filter(path => path.filter(item => item === 'items').length <= 1) // Schemas burried behind more than one array aren't relevant
        .map(path => getPathOr(null, path, json))
//        .filter(path => /^modules\//.test(path))
        .filter(path => seen.hasOwnProperty(path) ? false : (seen[path] = true))
        .map(path => _options.baseUrl + getLinkFromRef(path, _options.asPath))
//        .map(path => path.split('#')[0].split('/').pop().split('.')[0] + 'Schema#' + path.split('/').pop()) // reformat for git wiki
//        .map(path => path[0].toUpperCase() + path.substr(1)) // initial caps for git wiki
        //.map(path => (' - [' + path.split('#')[1] + (options.asPath ? '](../' : '](./') + path.split('#')[0] + '#' + path.split('#')[1].toLowerCase() + ')'))
        .map(path => ' - [' + path.split("/").pop() + '](' + (_options.asPath ? path.toLowerCase() : path) + ')')
        .join('\n')

    return links
}

function generateJavaScriptExample(example, m, module) {
    if (m.name.match(/^on[A-Z]/)) {
        return generateEventExample(example, m, module)
    }

    const formatParams = (params, delimit, pretty = false) => params.map(p => JSON.stringify((example.params.find(x => x.name === p.name) || { value: null }).value, null, pretty ? '  ' : null)).join(delimit)
    let indent = ' '.repeat(module.length + m.name.length + 2)
    let params = formatParams(m.params, ', ')
    if (params.length + indent > 80) {
        params = formatParams(m.params, ',\n', true)
        params = params.split('\n')
        let first = params.shift()
        params = params.map(p => indent + p)
        params.unshift(first)
        params = params.join('\n')
    }

    let typescript

    const template = m.tags && m.tags.map(t=>t.name).find(t => getAllTemplateNames().includes('examples/' + t + '.md')) || 'default'
    typescript = getTemplate(`examples/${template}.md`)

    typescript = typescript.replace(/\$\{example.params\}/g, params)

    return typescript
}

function generateJavaScriptExampleResult(example, m, module) {
    let typescript = JSON.stringify(example.result.value, null, '  ')

    return typescript
}

function generateRPCExample(example, m, module) {
    if (m.tags && m.tags.filter(t => (t.name === 'property-subscribe')).length) {
        return generatePropertyChangedRPCExample(example, m, module)
    }
    let request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": `${module.toLowerCase()}.${m.name}`,
        "params": {},
    }

    m.params.forEach(p => {
        let example_p = example.params.find(x => x.name === p.name)
        if (example_p) {
            request.params[p.name] = example_p.value
        }
    })

    return JSON.stringify(request, null, '  ')
}

function generatePropertyChangedRPCExample(example, m, module) {
    let request = {
        jsonrpc: "2.0",
        id: 1,
        "method": `${module.toLowerCase()}.on${m.name.substr(0, 1).toUpperCase()}${m.name.substr(1)}Changed`,
        "params": {
            listen: true
        },
    }

    return JSON.stringify(request, null, '  ')
}

function generateRPCExampleResult(example, m, module) {
    return JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "result": example.result.value
    }, null, '  ')
}

function generateRPCCallbackExample(example, m, module) {
    let request = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": `${module.toLowerCase()}.${m.name}`,
        "params": {
            "correlationId": "xyz",
            "result": {}
        }
    }

    if (example.result.value && example.result.value.data) {
        Object.keys(example.result.value.data).forEach(key => {
            request.params.result[key] = example.result.value.data[key]
        })
    }

    return JSON.stringify(request, null, '  ')
}

function generateRPCCallbackExampleResult(example, m, module) {
    return JSON.stringify({
        "jsonrpc": "2.0",
        "id": 1,
        "result": true
    }, null, '  ')
}

function generateEventExample(example, m, module) {
    let typescript = `import { ${module} } from '@firebolt-js/sdk'\n\n`
    typescript += `${module}.listen('${m.name[2].toLowerCase() + m.name.substr(3)}', ${m.result.name} => {\n`
    typescript += `  console.log(${m.result.name})\n`
    typescript += '})'

    return typescript
}