#!/usr/bin/env node

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

import { emptyDir, readDir, readFiles, readFilesPermissions, readJson,
         writeFiles, writeFilesPermissions, writeText } from '../shared/filesystem.mjs'
import { getTemplate, getTemplateForModule } from '../shared/template.mjs'
import { getModule, hasPublicAPIs } from '../shared/modules.mjs'
import { logHeader, logSuccess } from '../shared/io.mjs'
import path from 'path'
import engine from './engine.mjs'
import { getLocalSchemas, replaceRef } from '../shared/json-schema.mjs'

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
const macrofy = async (
  input,
  template,
  output,
  options
  ) => {
    const {
        sharedTemplates,
        examples=[],
        outputDirectory,
        staticContent,
        templatesPerModule,
        templatesPerSchema,
        persistPermission,
        createPolymorphicMethods,
        createModuleDirectories,
        copySchemasIntoModules,
        extractSubSchemas,
        unwrapResultObjects,
        allocatedPrimitiveProxies,
        convertTuplesToArraysOrObjects,
        additionalSchemaTemplates,
        additionalMethodTemplates,
        templateExtensionMap,
        excludeDeclarations,
        extractProviderSchema,
        aggregateFiles,
        operators,
        primitives,
        hidePrivate = true,
        hideExcluded = false,
        staticModuleNames = [],
        rename = {},
        clearTargetDirectory = true,
        headline,
        libraryName,
        treeshakePattern = null,
        treeshakeEntry = null,
        treeshakeTypes = []
    } = options

    return new Promise( async (resolve, reject) => {
        const openrpc = await readJson(input)

        logHeader(`Generating ${headline} for version ${openrpc.info.title} ${openrpc.info.version}`)

        let typer

        try {
//            const typerModule = await import(path.join(sharedTemplates, '..', 'Types.mjs'))
//            typer = typerModule.default
        }
        catch (_) {
//            typer = (await import('../shared/typescript.mjs')).default
        }

        typer = (await import('./types.mjs')).default

        engine.setTyper(typer)
        engine.setConfig({
            copySchemasIntoModules,
            createModuleDirectories,
            extractSubSchemas,
            unwrapResultObjects,
            primitives,
            allocatedPrimitiveProxies,
            additionalSchemaTemplates,
            additionalMethodTemplates,
            templateExtensionMap,
            excludeDeclarations,
            extractProviderSchema,
            operators
        })

        const moduleList = [...(new Set(openrpc.methods.map(method => method.name.split('.').shift())))]
        const sdkTemplateList = template ? await readDir(template, { recursive: true }) : []
        const sharedTemplateList = await readDir(sharedTemplates, { recursive: true })
        const templates = Object.assign(await readFiles(sharedTemplateList, sharedTemplates),
                                        await readFiles(sdkTemplateList, template)) // sdkTemplates are second so they win ties

        let templatesPermission = {}
        if (persistPermission) {
            templatesPermission = Object.assign(await readFilesPermissions(sharedTemplateList, sharedTemplates),
                                        await readFilesPermissions(sdkTemplateList, template))
        }

        const exampleTemplates = {}
        for (var i=0; i<examples.length; i++) {
            const example = examples[i]
            const config = await readJson(path.join(example, 'language.config.json'))
            exampleTemplates[
                config.name
            ] = await readFiles(
                await readDir(path.join(example, 'templates'), { recursive: true }), path.join(example, 'templates')
            )
            exampleTemplates[config.name]['__config'] = config
        }

        // check if this is a "real" language or just documentation broiler-plate, e.g. markdown
        if (Object.keys(templates).find(key => key.startsWith('/types/primitive'))) {
            typer.setTemplates && typer.setTemplates(templates)
            typer.setPrimitives(primitives)
        }
        else {
            const lang = Object.entries(exampleTemplates)[0][1]
            const prims = Object.entries(exampleTemplates)[0][1]['__config'].primitives
            // add the templates from the first example language and the wrapper langauage
            typer.setTemplates && typer.setTemplates(lang)
            typer.setTemplates && typer.setTemplates(templates)
            typer.setPrimitives(prims)
        }
        typer.setAllocatedPrimitiveProxies(allocatedPrimitiveProxies)
        typer.setConvertTuples(convertTuplesToArraysOrObjects)

        const staticCodeList = staticContent ? await readDir(staticContent, { recursive: true }) : []
        const staticModules = staticModuleNames.map(name => ( { info: { title: name } } ))

        let modules
        if (hidePrivate) {
            modules = moduleList.map(name => getModule(name, openrpc, copySchemasIntoModules, extractSubSchemas)).filter(hasPublicAPIs)
        }
        else {
            modules = moduleList.map(name => getModule(name, openrpc, copySchemasIntoModules, extractSubSchemas))
        }

        const aggregateMacros = engine.generateAggregateMacros(openrpc, modules.concat(staticModules), templates, libraryName)

        const outputFiles = Object.fromEntries(Object.entries(await readFiles( staticCodeList, staticContent))
                                .map( ([n, v]) => [path.join(output, n), v]))
        
        let primaryOutput = []

        Object.keys(templates).forEach(file => {
            if (file.startsWith(path.sep + outputDirectory + path.sep) || outputDirectory === '') {
                // Note: '/foo/bar/file.js'.split('/') => ['', 'foo', 'bar', 'file.js'] so we need to drop one more that you might suspect, hence slice(2) below...
                const dirsToDrop = outputDirectory === '' ? 1 : 2
                let outputFile = path.sep + file.split(path.sep).slice(dirsToDrop).join(path.sep)
                const isPrimary = (aggregateFiles && aggregateFiles.includes(outputFile))
                if (rename[outputFile]) {
                    outputFile = outputFile.split(path.sep).slice(0, -1).concat([rename[outputFile]]).join(path.sep)
                }

                if (isPrimary) {
                    primaryOutput.push(path.join(output, outputFile))
                }

                const content = engine.insertAggregateMacros(templates[file], aggregateMacros)
                outputFiles[path.join(output, outputFile)] = content
                if (persistPermission) {
                    templatesPermission[path.join(output, outputFile)] = templatesPermission[file]
                }
                logSuccess(`Generated macros for file ${path.relative(output, path.join(output, outputFile))}`)
            }
            if (persistPermission) {
                delete templatesPermission[file]
            }
        })

        let append = false

        modules.forEach(module => {

            // Pick the index and defaults templates for each module.
            templatesPerModule.forEach(t => {
                const macros = engine.generateMacros(module, templates, exampleTemplates, {hideExcluded: hideExcluded, copySchemasIntoModules: copySchemasIntoModules, createPolymorphicMethods: createPolymorphicMethods, destination: t, type: 'methods'})
                let content = getTemplateForModule(module.info.title, t, templates)
                
                // NOTE: whichever insert is called first also needs to be called again last, so each phase can insert recursive macros from the other
                content = engine.insertAggregateMacros(content, aggregateMacros)
                content = engine.insertMacros(content, macros)
                content = engine.insertAggregateMacros(content, aggregateMacros)

                const location = createModuleDirectories ? path.join(output, module.info.title, t) : path.join(output, t.replace(/module/, module.info.title.toLowerCase()).replace(/index/, module.info.title))
                
                outputFiles[location] = content
                logSuccess(`Generated macros for module ${path.relative(output, location)}`)
            })

            primaryOutput.forEach(output => {
                const macros = engine.generateMacros(module, templates, exampleTemplates, {hideExcluded: hideExcluded, copySchemasIntoModules: copySchemasIntoModules, createPolymorphicMethods: createPolymorphicMethods, destination: output})
                macros.append = append
                outputFiles[output] = engine.insertMacros(outputFiles[output], macros)
            })

            append = true
        })
        primaryOutput.forEach(output => {
            outputFiles[output] = engine.clearMacros(outputFiles[output]);
        })

        if (treeshakePattern && treeshakeEntry) {
            const importedFiles = (code, base) => Array.from(new Set([...code.matchAll(treeshakePattern)].map(arr => arr[2]))).map(i => path.join(output, base, i))

            const treeShake = (entry, base='', checked = []) => {
                const code = outputFiles[entry]

                if (code) {
                    let imports = []

                    if (!checked.includes(entry)) {
                        imports = importedFiles(code, base)
                        checked.push(entry)    
                    }

                    imports = imports.map(imp => Array.from(new Set([imp, ...treeShake(imp, path.dirname(imp).substring(output.length), checked)]))).flat()

                    return Array.from(new Set([entry, ...imports]))
                }
                else {
                    return []
                }
            }

            const keep = treeShake(path.join(output, treeshakeEntry))
            Object.keys(outputFiles).forEach(file => {
                if (!keep.find(x => x === file) && treeshakeTypes.find(type => file.endsWith(type))) {
                    logSuccess(`Tree-shaking ${path.relative(output, file)} from project.`)
                    delete outputFiles[file]
                }
            })
        }

        // Grab all schema groups w/ a URI string. These came from some external json-schema that was bundled into the OpenRPC
        const externalSchemas = {}
        openrpc['x-schemas']
            && Object.entries(openrpc['x-schemas']).forEach(([name, schema]) => {                
                if (schema.uri) {
                    const id = schema.uri
                    externalSchemas[id] = externalSchemas[id] || { $id: id, info: {title: name }, methods: []}
                    externalSchemas[id].components = externalSchemas[id].components || {}
                    externalSchemas[id].components.schemas = externalSchemas[id].components.schemas || {}
                    externalSchemas[id]['x-schemas'] = JSON.parse(JSON.stringify(openrpc['x-schemas']))

                    const schemas = JSON.parse(JSON.stringify(schema))
                    delete schemas.uri
                    Object.assign(externalSchemas[id].components.schemas, schemas)
                }
        })

        // update the refs
        Object.values(externalSchemas).forEach( document => {
            getLocalSchemas(document).forEach((path) => {
                const parts = path.split('/')
                // Drop the grouping path element, since we've pulled this schema out into it's own document
                if (parts.length === 4 && path.startsWith('#/x-schemas/' + document.info.title + '/')) {
                    replaceRef(path, ['#/components/schemas', parts[3]].join('/'), document)
                }
                // Add the fully qualified URI for any schema groups other than this one
                else if (parts.length === 4 && path.startsWith('#/x-schemas/')) {
                    const uri = openrpc['x-schemas'][parts[2]].uri
                    // store the case-senstive group title for later use
                    document.info['x-uri-titles'] = document.info['x-uri-titles'] || {}
                    document.info['x-uri-titles'][uri] = document.info.title
                    openrpc.info['x-uri-titles'] = openrpc.info['x-uri-titles'] || {}
                    openrpc.info['x-uri-titles'][uri] = document.info.title
                    replaceRef(path, '#/x-schemas/' + parts[2] + '/' + parts[3], document)
                }
            })
        })
                
        // Output any schema templates for each bundled external schema document
        Object.values(externalSchemas).forEach( document => {
            if (templatesPerSchema) {
                templatesPerSchema.forEach( t => {
                    const macros = engine.generateMacros(document, templates, exampleTemplates, {hideExcluded: hideExcluded, createPolymorphicMethods: createPolymorphicMethods, destination: t})
                    let content = getTemplate('/schemas', t, templates)
        
                    // NOTE: whichever insert is called first also needs to be called again last, so each phase can insert recursive macros from the other
                    content = engine.insertMacros(content, macros)
        
                    const location = createModuleDirectories ? path.join(output, document.info.title, t) : path.join(output, t.replace(/module/, document.info.title.toLowerCase()).replace(/index/, document.info.title))
        
                    outputFiles[location] = content
                    logSuccess(`Generated macros for schema ${path.relative(output, location)}`)
                })
            }
        })

        if (clearTargetDirectory) {
            logSuccess(`Cleared ${path.relative('.', output)} directory`)
            await emptyDir(output)
        }

        await writeFiles(outputFiles)
        if (persistPermission) {
            await writeFilesPermissions(templatesPermission)
        }
        logSuccess(`Wrote ${Object.keys(outputFiles).length} files.`)

        resolve()
    })
}

export default macrofy
