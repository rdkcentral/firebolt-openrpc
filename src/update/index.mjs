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

import { readJson, readFiles, readDir, writeJson, writeFiles } from "../shared/filesystem.mjs"
import { addExternalMarkdown, addExternalSchemas, fireboltize } from "../shared/modules.mjs"
import path from "path"
import { logHeader, logSuccess } from "../shared/io.mjs"
import { isEvent, isProvider } from "../shared/methods.mjs"
import { getReferencedSchema } from '../shared/json-schema.mjs'

const run = async ({
  input: input
}) => {

  logHeader(`Upgrading modules to latest Firebolt OpenRPC schema`)

  const moduleList = input ? await readDir(path.join(input, 'openrpc'), { recursive: true, base: path.resolve('.') }) : []
  const modules = await readFiles(moduleList, path.resolve('.') + '/.')

  console.log(input)
  console.log(path.resolve(input))
  console.dir(moduleList)

  Object.keys(modules).forEach(key => {
    let json = JSON.parse(modules[key])

    // Do the firebolt API magic
    update(json)

    modules[key] = JSON.stringify(json, null, '\t')

    logSuccess(`Updated the ${json.info.title} module.`)
  })

  await writeFiles(modules)

  console.log()
  logSuccess(`Wrote files`)

  return Promise.resolve()
}

function update(json) {
    json.methods = json.methods.map(method => {
        // update providers
        if (isProvider(method)) {
            // handle Provider Interfaces
            if (method.name.startsWith('onRequest')) {
                // simplify name
                method.name = method.name.charAt(9).toLowerCase() + method.name.substr(10)

                // move params out of custom extension, and unwrap them into individual parameters
                method.params.splice(0, method.params.length)
                console.dir(method)
                console.log(method.result.schema.$ref)
                const request = method.result.schema.$ref ? getReferencedSchema(method.result.schema.$ref, json) : method.result.schema
                console.dir(request, { depth: 10 })
                console.log((request.allOf ? request.allOf[1] : request).properties.parameters)
                let params = (request.allOf ? request.allOf[1] : request).properties.parameters
                if (params.$ref) {
                    params = getReferencedSchema(params.$ref, json)
                }

                // add required params first, in order listed
                params.required && params.required.forEach(p => {
                    method.params.push({
                       name: p,
                        required: true,
                        schema: params.properties[p]
                    })
                    delete params.properties[p]
                })

                // add unrequired params in arbitrary order... (there's currently no provider method method with more than one unrequired param)
                if (params.type === "object" && params.properties) {
                    Object.keys(params.properties).forEach(p => {
                        method.params.push({
                            name: p,
                            required: false,
                            schema: params.properties[p]
                        })
                        delete params.properties[p] 
                    })
                }

                // move result out of custom extension
                method.result = {
                    name: 'result',
                    schema: isEvent(method)['x-response'] || { type: "null", examples: [ null ] }
                }
                
                // fix example pairings
                method.examples.forEach((example, i) => {
                    if (example.result.value.parameters) {
                        example.params = Object.entries(example.result.value.parameters).map(entry => ({
                            name: entry[0],
                            value: entry[1]
                        }))
                    }

                    const result = method.result.schema.examples ? method.result.schema.examples[Math.min(i, method.result.schema.examples.length-1)] : getReferencedSchema(method.result.schema.$ref, json).examples[0]
                    example.result = {
                        "name": "result",
                        "value": result
                    }
                })

                // delete examples, TODO: this needs to go into the method pairing examples...
                delete method.result.schema.examples

                // TODO handle x-error
                for (var i=method.tags.length-1; i>=0; i--) {
                    if (method.tags[i].name === "event" || method.tags[i].name === "rpc-only") {
                        method.tags.splice(i, 1)
                    }
                }

                method.tags = method.tags.filter(tag => (tag.name !== "event" && tag.name !== "rpc-only"))
            }
        }
        else if (isEvent(method)) {
            // store the subscriber name in the x-event extension
            isEvent(method)['x-event'] = json.info.title + '.' + method.name

            // simplify name
            method.name = method.name.charAt(2).toLowerCase() + method.name.substr(3)
            // put the notification playload at the end of the params
            method.params.push(method.result)

            // rename the event tag to notifier
            isEvent(method).name = "notifier"

            // remove the result, since this is a notification
            delete method.result

            method.examples.forEach(example => {
                example.params.push(example.result)
                delete example.result
            })
        }
        return method
    })

    json.methods = json.methods.filter(m => !m.tags.find(t => t.name === 'polymorphic-push'))

    // look for pass-through providers w/ same name as use method
    json.methods.filter(m => json.methods.filter(x => x.name === m.name).length > 1)
                .filter(m => m.tags.find(t => t.name === 'capabilities')['x-provides'])
                .reverse()
                .forEach(provider => {
                    const i = json.methods.indexOf(provider)
                    json.methods.splice(i, 1)
                    json.methods.find(m => m.name === provider.name).tags.find(t => t.name === 'capabilities')['x-provided-by'] = json.info.title+'.'+provider.name
                    console.dir(json.methods.find(m => m.name === provider.name))
                })
    
}

export default run