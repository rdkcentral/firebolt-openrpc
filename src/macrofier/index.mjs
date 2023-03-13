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

import { emptyDir, readDir, readFiles, readJson, writeFiles, writeText } from '../shared/filesystem.mjs'
import { getTemplateForModule } from '../shared/template.mjs'
import { getModule, getSemanticVersion, isRPCOnlyMethod } from '../shared/modules.mjs'
import { logHeader, logSuccess } from '../shared/io.mjs'
import path from 'path'
import engine from './engine.mjs'

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
        createModuleDirectories,
        aggregateFile,
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
            const typerModule = await import(path.join(sharedTemplates, '..', 'Types.mjs'))
            typer = typerModule.default
        }
        catch (_) {
            typer = (await import('../shared/typescript.mjs')).default
        }

        engine.setTyper(typer)

        const moduleList = [...(new Set(openrpc.methods.map(method => method.name.split('.').shift())))]
        const sdkTemplateList = template ? await readDir(template, { recursive: true }) : []
        const sharedTemplateList = await readDir(sharedTemplates, { recursive: true })
        const templates = Object.assign(await readFiles(sharedTemplateList, sharedTemplates),
                                        await readFiles(sdkTemplateList, template)) // sdkTemplates are second so they win ties
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


        const staticCodeList = staticContent ? await readDir(staticContent, { recursive: true }) : []
        const staticModules = staticModuleNames.map(name => ( { info: { title: name } } ))

        const hasPublicInterfaces = json => json.methods && json.methods.filter(m => m.tags && m.tags.find(t=>t['x-provides'])).length > 0
        const hasPublicAPIs = json => hasPublicInterfaces(json) || (json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0)
        
        let modules
        
        if (hidePrivate) {
            modules = moduleList.map(name => getModule(name, openrpc)).filter(hasPublicAPIs)
        }
        else {
            modules = moduleList.map(name => getModule(name, openrpc))
        }

        const aggregateMacros = engine.generateAggregateMacros(openrpc, modules.concat(staticModules), templates, libraryName)

        const outputFiles = Object.fromEntries(Object.entries(await readFiles( staticCodeList, staticContent))
                                .map( ([n, v]) => [path.join(output, n), v]))
        
        let primaryOutput

        Object.keys(templates).forEach(file => {
            if (file.startsWith(path.sep + outputDirectory + path.sep) || outputDirectory === '') {
                // Note: '/foo/bar/file.js'.split('/') => ['', 'foo', 'bar', 'file.js'] so we need to drop one more that you might suspect, hence slice(2) below...
                const dirsToDrop = outputDirectory === '' ? 1 : 2
                let outputFile = path.sep + file.split(path.sep).slice(dirsToDrop).join(path.sep)
                const isPrimary = outputFile === aggregateFile

                if (rename[outputFile]) {
                    outputFile = outputFile.split(path.sep).slice(0, -1).concat([rename[outputFile]]).join(path.sep)
                }

                if (isPrimary) {
                    primaryOutput = path.join(output, outputFile)
                }

                const content = engine.insertAggregateMacros(templates[file], aggregateMacros)
                outputFiles[path.join(output, outputFile)] = content

                logSuccess(`Generated macros for file ${path.relative(output, path.join(output, outputFile))}`)
            }
        })

        let append = false

        modules.forEach(module => {

            // Pick the index and defaults templates for each module.
            templatesPerModule.forEach(t => {
                const macros = engine.generateMacros(module, templates, exampleTemplates, {hideExcluded: hideExcluded, destination: t})
                let content = getTemplateForModule(module.info.title, t, templates)

                // NOTE: whichever insert is called first also needs to be called again last, so each phase can insert recursive macros from the other
                content = engine.insertAggregateMacros(content, aggregateMacros)
                content = engine.insertMacros(content, macros)
                content = engine.insertAggregateMacros(content, aggregateMacros)

                const location = createModuleDirectories ? path.join(output, module.info.title, t) : path.join(output, t.replace(/Module/, module.info.title).replace(/index/, module.info.title))

                outputFiles[location] = content
                logSuccess(`Generated macros for ${path.relative(output, location)}`)
            })

            if (primaryOutput) {
                const macros = engine.generateMacros(module, templates, exampleTemplates, {hideExcluded: hideExcluded, destination: primaryOutput})
                macros.append = append
                outputFiles[primaryOutput] = engine.insertMacros(outputFiles[primaryOutput], macros)
            }

            append = true
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

            console.log()
        }

        if (clearTargetDirectory) {
            logSuccess(`Cleared ${path.relative('.', output)} directory`)
            await emptyDir(output)
        }

        await writeFiles(outputFiles)    
        logSuccess(`Wrote ${Object.keys(outputFiles).length} files.`)

        resolve()
    })
}

export default macrofy