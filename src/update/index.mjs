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
import { capabilities, event, provides, pusher } from "../shared/methods.mjs"
import { getPath } from '../shared/json-schema.mjs'

const run = async ({
  input: input,
  output: output
}) => {

  logHeader(`Upgrading modules to latest Firebolt OpenRPC schema`)

  console.dir(input)
  const moduleList = input ? await readDir(path.join(input, 'openrpc'), { recursive: true }) : []
  console.dir(moduleList)
  const modules = await readFiles(moduleList, path.resolve('.') + '/.')
  console.dir(Object.keys(modules))

  Object.keys(modules).forEach(key => {
    let json = JSON.parse(modules[key])

    // Do the firebolt API magic
    update(json)

    modules[key] = JSON.stringify(json, null, '\t')

    logSuccess(`Updated the ${json.info.title} module.`)
  })

  await writeFiles(modules)
console.log(Object.keys(modules))

  console.log()
  logSuccess(`Wrote file ${path.relative('.', output)}`)

  return Promise.resolve()
}

function update(json) {
    json.methods = json.methods.map(method => {
        // update providers
        if (provides(method)) {
            // handle Provider Interfaces
            if (method.name.startsWith('onRequest')) {
                // simplify name
                method.name = method.name.charAt(9).toLowerCase() + method.name.substr(10)

                // move params out of custom extension, and unwrap them into individual parameters
                method.params = []
                const request = getPath(method.result.schema.$ref, json)
                const params = getPath((request.allOf ? request.allOf[1] : request).properties.parameters.$ref, json)

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
                Object.keys(params.properties).forEach(p => {
                    method.params.push({
                        name: p,
                         required: false,
                         schema: params[p]
                     })
                     delete params.properties[p] 
                })


                // move result out of custom extension
                method.result = {
                    name: 'result',
                    schema: event(method)['x-response']
                }
                
                // fix example pairings
                method.examples.forEach((example, i) => {
                    example.params = Object.entries(example.result.value.parameters).map(entry => ({
                        name: entry[0],
                        value: entry[1]
                    }))
                    const result = method.result.schema.examples ? method.result.schema.examples[Math.min(i, method.result.schema.examples.length-1)] : getPath(method.result.schema.$ref, json).examples[0]
                    example.result = {
                        "name": "result",
                        "value": result
                    }
                })

                // delete examples, TODO: this needs to go into the method pairing examples...
                delete method.result.schema.examples

                // TODO handle x-error

                method.tags = method.tags.filter(tag => (tag.name !== "event" && tag.name !== "rpc-only"))
            }
        }
        else if (event(method)) {
            console.dir(method.name)
            // store the subscriber name in the x-event extension
            event(method)['x-event'] = json.info.title + '.' + method.name

            // simplify name
            method.name = method.name.charAt(2).toLowerCase() + method.name.substr(3)
            // move the result into the single param
            method.params = [
                method.result
            ]

            // rename the event tag to notifier
            event(method).name = "notifier"

            // remove the result, since this is a notification
            delete method.result
        }
        return method
    })
}

export default run