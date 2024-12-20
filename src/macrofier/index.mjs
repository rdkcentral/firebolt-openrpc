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
import { getAppApiModule, getModule, hasPublicAPIs } from '../shared/modules.mjs'
import { logHeader, logSuccess } from '../shared/io.mjs'
import Types from './types.mjs'
import path from 'path'
import engine from './engine.mjs'
import { flattenMultipleOfs, replaceUri } from '../shared/json-schema.mjs'

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
const macrofy = async (
  platformApi,
  appApi,
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
        enableUnionTypes,
        createModuleDirectories,
        copySchemasIntoModules,
        mergeOnTitle,
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
        treeshakeTypes = [],
        moduleWhitelist = []
    } = options

    return new Promise( async (resolve, reject) => {
        const platformApiOpenRpc = await readJson(platformApi)
        const appApiOpenRpc = appApi && await readJson(appApi) || null

        logHeader(`Generating ${headline} for version ${platformApiOpenRpc.info.title} ${platformApiOpenRpc.info.version}`)

        engine.setConfig({
            copySchemasIntoModules,
            mergeOnTitle,
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

        const moduleList = [...(new Set(platformApiOpenRpc.methods.map(method => method.name.split('.').shift())))]
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
            Types.setTemplates && Types.setTemplates(templates)
            Types.setPrimitives(primitives)
        }
        else {
            const lang = Object.entries(exampleTemplates)[0][1]
            const prims = Object.entries(exampleTemplates)[0][1]['__config'].primitives
            // add the templates from the first example language and the wrapper langauage
            Types.setTemplates && Types.setTemplates(lang)
            Types.setTemplates && Types.setTemplates(templates)
            Types.setPrimitives(prims)
        }
        Types.setAllocatedPrimitiveProxies(allocatedPrimitiveProxies)
        Types.setConvertTuples(convertTuplesToArraysOrObjects)

        const staticCodeList = staticContent ? await readDir(staticContent, { recursive: true }) : []
        const staticModules = staticModuleNames.map(name => ( { info: { title: name } } ))

        let modules

        if (hidePrivate) {
            modules = moduleList.map(name => getModule(name, platformApiOpenRpc, copySchemasIntoModules, extractSubSchemas)).filter(hasPublicAPIs)
        } else {
            modules = moduleList.map(name => getModule(name, platformApiOpenRpc, copySchemasIntoModules, extractSubSchemas))
        }

        // Grab all schema groups w/ a URI string. These came from some external json-schema that was bundled into the OpenRPC
        const externalSchemas = {}
        platformApiOpenRpc.components && platformApiOpenRpc.components.schemas
            && Object.entries(platformApiOpenRpc.components.schemas).filter(([_, schema]) => schema.$id).forEach(([name, schema]) => {
                    const id = schema.$id
                    externalSchemas[id] = JSON.parse(JSON.stringify(schema))
                    replaceUri(id, '', externalSchemas[id])
                    Object.values(platformApiOpenRpc.components.schemas).forEach(schema => {
                        if (schema.$id && schema.$id !== id) {
                            externalSchemas[id].definitions[schema.$id] = schema
                        }
                    })
            })

        const aggregatedExternalSchemas = mergeOnTitle ? Object.values(externalSchemas).filter(s => !modules.find(m => m.info.title === s.title)) : Object.values(externalSchemas)

        const aggregateMacros = engine.generateAggregateMacros(platformApiOpenRpc, appApiOpenRpc, modules.concat(staticModules).concat(copySchemasIntoModules ? [] : Object.values(aggregatedExternalSchemas)), templates, libraryName)
        logSuccess(`Generated aggregate macros`)


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
                logSuccess(`Inserted aggregate macros for file ${path.relative(output, path.join(output, outputFile))}`)
            }
            if (persistPermission) {
                delete templatesPermission[file]
            }
        })

        let append = false

        modules.forEach(module => {
            const appApiOpenRpc2 = appApiOpenRpc && getAppApiModule(module.info.title, appApiOpenRpc, module)
            logSuccess(` - gotAppApiModule`)
            
            const macros = engine.generateMacros(module, appApiOpenRpc2, templates, exampleTemplates, {hideExcluded: hideExcluded, copySchemasIntoModules: copySchemasIntoModules, createPolymorphicMethods: createPolymorphicMethods, type: 'methods'})
            logSuccess(`Generated macros for module ${module.info.title}`)
            
            // Pick the index and defaults templates for each module.
            templatesPerModule.forEach(t => {
                let content = getTemplateForModule(module.info.title, t, templates)
                
                // NOTE: whichever insert is called first also needs to be called again last, so each phase can insert recursive macros from the other
                content = engine.insertAggregateMacros(content, aggregateMacros)
                content = engine.insertMacros(content, macros)
                content = engine.insertAggregateMacros(content, aggregateMacros)

                const location = createModuleDirectories ? path.join(output, module.info.title, t) : path.join(output, t.replace(/module/, module.info.title.toLowerCase()).replace(/index/, module.info.title))
                
                outputFiles[location] = content
                logSuccess(` - Inserted ${module.info.title} macros for template ${path.relative(output, location)}`)            
            })

            primaryOutput.forEach(output => {
                macros.append = append
                outputFiles[output] = engine.insertMacros(outputFiles[output], macros)
                logSuccess(` - Inserted ${module.info.title} macros for template ${output}`)
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
                } else {
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
                
        // Output any schema templates for each bundled external schema document
        !copySchemasIntoModules && Object.values(externalSchemas).forEach( document => {
          if (mergeOnTitle && modules.find(m => m.info.title === document.title)) {
              return // skip this one, it was already merged into the module w/ the same name
          }

          const macros = engine.generateMacros(document, null, templates, exampleTemplates, {hideExcluded: hideExcluded, copySchemasIntoModules: copySchemasIntoModules, createPolymorphicMethods: createPolymorphicMethods })

          if (templatesPerSchema || primaryOutput.length) {
              templatesPerSchema && templatesPerSchema.forEach( t => {
                    let content = getTemplate('/schemas', t, templates)
                    content = engine.insertMacros(content, macros)
        
                    const location = createModuleDirectories ? path.join(output, document.title, t) : path.join(output, t.replace(/module/, document.title.toLowerCase()).replace(/index/, document.title))
        
                    outputFiles[location] = content
                    logSuccess(`Generated macros for schema ${path.relative(output, location)}`)
                })

                primaryOutput && primaryOutput.forEach(output => {
                  macros.append = append
                  outputFiles[output] = engine.insertMacros(outputFiles[output], macros)
                })

              append = true
            }
        })

        if (clearTargetDirectory) {
            logSuccess(`Cleared ${path.relative('.', output)} directory`)
            await emptyDir(output)
        }

        await writeFiles(outputFiles)
        if (persistPermission) {
            // Need to take a closer look at why this was commented out
            // await writeFilesPermissions(templatesPermission)
        }
        logSuccess(`Wrote ${Object.keys(outputFiles).length} files.`)

        resolve()
    })
}

export default macrofy
