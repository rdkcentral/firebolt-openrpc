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
import { logHeader, logSuccess } from './io.mjs'
import path from 'path'

/************************************************************************************************/
/******************************************** MAIN **********************************************/
/************************************************************************************************/
const macrofy = async (
  input,
  template,
  output,
  engine,
  options
  ) => {
    const {
        sharedTemplates,
        outputDirectory,
        staticContent,
        templatesPerModule,
        hidePrivate = true,
        staticModuleNames = [],
        rename = {},
        clearTargetDirectory = true,
        headline
    } = options

    return new Promise( async (resolve, reject) => {
        const openrpc = await readJson(input)

        logHeader(`Generating ${headline} for version ${openrpc.info.title} ${openrpc.info.version}`)

        if (hidePrivate) {
//            openrpc.methods && (openrpc.methods = openrpc.methods.filter(method => !isRPCOnlyMethod(method)))
        }

        const moduleList = [...(new Set(openrpc.methods.map(method => method.name.split('.').shift())))]
        const sdkTemplateList = template ? await readDir(template, { recursive: true }) : []
        const sharedTemplateList = await readDir(sharedTemplates, { recursive: true })
        const templates = Object.assign(await readFiles(sharedTemplateList, sharedTemplates),
                                        await readFiles(sdkTemplateList, template)) // sdkTemplates are second so they win ties
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

        const aggregateMacros = engine.generateAggregateMacros(openrpc, modules.concat(staticModules), templates)

        const outputFiles = Object.fromEntries(Object.entries(await readFiles( staticCodeList, staticContent))
                                .map( ([n, v]) => [path.join(output, n), v]))

        Object.keys(templates).forEach(file => {
            if (file.startsWith(path.sep + outputDirectory + path.sep) || outputDirectory === '') {
                // Note: '/foo/bar/file.js'.split('/') => ['', 'foo', 'bar', 'file.js'] so we need to drop one more that you might suspect, hence slice(2) below...
                const dirsToDrop = outputDirectory === '' ? 1 : 2
                let outputFile = path.sep + file.split(path.sep).slice(dirsToDrop).join(path.sep)
                if (rename[outputFile]) {
                    outputFile = outputFile.split(path.sep).slice(0, -1).concat([rename[outputFile]]).join(path.sep)
                }
                outputFiles[path.join(output, outputFile)] = engine.insertAggregateMacros(templates[file], aggregateMacros)
                logSuccess(`Generated macros for file ${path.relative(output, path.join(output, outputFile))}`)
            }
        })

        modules.forEach(module => {
            const macros = engine.generateMacros(module, templates)

            // Pick the index and defaults templates for each module.
            templatesPerModule.forEach(t => {
                const content = getTemplateForModule(module.info.title, t, templates)
                outputFiles[path.join(output, module.info.title, t)] = engine.insertMacros(engine.insertAggregateMacros(content, aggregateMacros), macros)
                logSuccess(`Generated macros for ${module.info.title}/${t}`)
            })

            // TODO, generate "other files" in module directory. is this needed?
        })

        console.log()
        
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