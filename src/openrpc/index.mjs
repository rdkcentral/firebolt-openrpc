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

import { readJson, readFiles, readDir, writeJson } from "../shared/filesystem.mjs"
import { addExternalMarkdown, addExternalSchemas, fireboltize } from "../shared/modules.mjs"
import path from "path"
import { logHeader, logSuccess } from "../shared/io.mjs"
import { namespaceRefs } from "../shared/json-schema.mjs"

const run = async ({
  input: input,
  client: client,
  server: server,
  template: template,
  schemas: schemas,
}) => {

  let serverOpenRPC = await readJson(template)
  let clientOpenRPC = client && await readJson(template)
  let mergedOpenRpc = await readJson(template)

  const sharedSchemaList = schemas ? (await Promise.all(schemas.map(d => readDir(d, { recursive: true })))).flat() : []
  const sharedSchemas = await readFiles(sharedSchemaList)

  try {
    const packageJson = await readJson(path.join(input, '..', 'package.json'))
    serverOpenRPC.info.version = packageJson.version
    clientOpenRPC && (clientOpenRPC.info.version = packageJson.version)
  }
  catch (error) {
    // fail silently
  }

  logHeader(`Generating compiled ${serverOpenRPC.info.title} OpenRPC document version ${serverOpenRPC.info.version}`)

  Object.entries(sharedSchemas).forEach(([path, schema]) => {
    const json = JSON.parse(schema)
    const id = json.$id
    sharedSchemas[id] = json
    delete sharedSchemas[path]
  })

  const moduleList = input ? await readDir(path.join(input, 'openrpc'), { recursive: true }) : []
  const modules = await readFiles(moduleList, path.join(input, 'openrpc'))

  const descriptionsList = input ? await readDir(path.join(input, 'descriptions'), { recursive: true }) : []
  const markdown = await readFiles(descriptionsList, path.join(input, 'descriptions'))

  const isNotifier = method => method.tags.find(t => t.name === 'notifier')
  const isProvider = method => method.tags.find(t => t.name === 'capabilities')['x-provides'] && !method.tags.find(t => t.name === 'event')
  const isClientAPI = method => client && (isNotifier(method) || isProvider(method))
  const isServerAPI = method => !isClientAPI(method)

  Object.keys(modules).forEach(key => {
    let json = JSON.parse(modules[key])

    // pull in external markdown files for descriptions
    json = addExternalMarkdown(json, markdown)

    // put module name in front of each method
    json.methods.filter(method => method.name.indexOf('.') === -1).forEach(method => method.name = json.info.title + '.' + method.name)

    // merge any info['x-'] extension values (maps & arrays only..)
    Object.keys(json.info).filter(key => key.startsWith('x-')).forEach(extension => {
      if (Array.isArray(json.info[extension])) {
        mergedOpenRpc.info[extension] = mergedOpenRpc.info[extension] || []
        mergedOpenRpc.info[extension].push(...json.info[extension])
      }
      else if (typeof json.info[extension] === 'object') {
        mergedOpenRpc.info[extension] = mergedOpenRpc.info[extension] || {}
        Object.keys(json.info[extension]).forEach(k => {
          mergedOpenRpc.info[extension][k] = json.info[extension][k]
        })
      }
    })

    if (json.info.description) {
      mergedOpenRpc.info['x-module-descriptions'] = mergedOpenRpc.info['x-module-descriptions'] || {}
      mergedOpenRpc.info['x-module-descriptions'][json.info.title] = json.info.description
    }

    // add methods from this module
    mergedOpenRpc.methods.push(...json.methods)

    // add schemas from this module
//    json.components && Object.assign(mergedOpenRpc.components.schemas, json.components.schemas)

    json.components && json.components.schemas && Object.assign(mergedOpenRpc.components.schemas, Object.fromEntries(Object.entries(json.components.schemas).map( ([key, schema]) => ([json.info.title + '.' + key, schema]) )))
    namespaceRefs('', json.info.title, mergedOpenRpc)

    // add externally referenced schemas that are in our shared schemas path
    mergedOpenRpc = addExternalSchemas(mergedOpenRpc, sharedSchemas)

    logSuccess(`Merged the ${json.info.title} module.`)
  })

  // Fireboltize!
  mergedOpenRpc = fireboltize(mergedOpenRpc, !!client)

  Object.assign(serverOpenRPC.info, mergedOpenRpc.info)

  // split into client & server APIs
  serverOpenRPC.methods.push(...mergedOpenRpc.methods.filter(isServerAPI))
  clientOpenRPC && clientOpenRPC.methods.push(...mergedOpenRpc.methods.filter(isClientAPI))

  // add schemas - TODO: this just blindly copies them all
  mergedOpenRpc.components && Object.assign(serverOpenRPC.components.schemas, mergedOpenRpc.components.schemas)
  clientOpenRPC && mergedOpenRpc.components && Object.assign(clientOpenRPC.components.schemas, mergedOpenRpc.components.schemas)

  // add externally referenced schemas that are in our shared schemas path
  serverOpenRPC = addExternalSchemas(serverOpenRPC, sharedSchemas)

  // add externally referenced schemas that are in our shared schemas path
  clientOpenRPC && (clientOpenRPC = addExternalSchemas(clientOpenRPC, sharedSchemas))

  await writeJson(server, serverOpenRPC)
  clientOpenRPC && await writeJson(client, clientOpenRPC)

  logSuccess(`Wrote file ${path.relative('.', server)}`)
  client && logSuccess(`Wrote file ${path.relative('.', client)}`)

  return Promise.resolve()
}

export default run