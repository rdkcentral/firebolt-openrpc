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

const run = async ({
  input: input,
  output: output,
  template: template,
  schemas: schemas,
}) => {

  let openrpc = await readJson(template)
  const sharedSchemaList = schemas ? (await Promise.all(schemas.map(d => readDir(d, { recursive: true, base: path.resolve('.') })))).flat() : []
  const sharedSchemas = await readFiles(sharedSchemaList, path.resolve('.'))

  try {
    const packageJson = await readJson(path.join(input, '..', 'package.json'))
    openrpc.info.version = packageJson.version
  }
  catch (error) {
    // fail silently
  }

  logHeader(`Generating compiled ${openrpc.info.title} OpenRPC document version ${openrpc.info.version}`)

  Object.entries(sharedSchemas).forEach(([path, schema]) => {
    const json = JSON.parse(schema)
    const id = json.$id
    if (id) { 
      sharedSchemas[id] = json
      delete sharedSchemas[path]
    }
    else {
      sharedSchemas[path] = json
    }
  })

  const moduleList = input ? await readDir(path.join(input, 'openrpc'), { recursive: true, base: path.resolve('.') }) : []
  const modules = await readFiles(moduleList, path.resolve('..'))

  const descriptionsList = input ? await readDir(path.join(input, 'descriptions'), { recursive: true, base: path.resolve('.') }) : []
  const markdown = await readFiles(descriptionsList, path.join(input, 'descriptions'))

  Object.keys(modules).forEach(key => {
    let json = JSON.parse(modules[key])

    // Do the firebolt API magic
    json = fireboltize(json)

    // pull in external markdown files for descriptions
    json = addExternalMarkdown(json, markdown)

    // put module name in front of each method
    json.methods.forEach(method => method.name = json.info.title + '.' + method.name)

    // merge any info['x-'] extension values (maps & arrays only..)
    Object.keys(json.info).filter(key => key.startsWith('x-')).forEach(extension => {
      if (Array.isArray(json.info[extension])) {
        openrpc.info[extension] = openrpc.info[extension] || []
        openrpc.info[extension].push(...json.info[extension])
      }
      else if (typeof json.info[extension] === 'object') {
        openrpc.info[extension] = openrpc.info[extension] || {}
        Object.keys(json.info[extension]).forEach(k => {
          openrpc.info[extension][k] = json.info[extension][k]
        })
      }
    })

    if (json.info.description) {
      openrpc.info['x-module-descriptions'] = openrpc.info['x-module-descriptions'] || {}
      openrpc.info['x-module-descriptions'][json.info.title] = json.info.description
    }


    // add methods from this module
    openrpc.methods.push(...json.methods)

    // add schemas from this module
    json.components && Object.assign(openrpc.components.schemas, json.components.schemas)

    // add externally referenced schemas that are in our shared schemas path
    openrpc = addExternalSchemas(openrpc, sharedSchemas, path.dirname(key))

    modules[key] = JSON.stringify(json, null, '\t')

    logSuccess(`Generated the ${json.info.title} module.`)
  })

  await writeJson(output, openrpc)

  console.log()
  logSuccess(`Wrote file ${path.relative('.', output)}`)

  return Promise.resolve()
}

export default run