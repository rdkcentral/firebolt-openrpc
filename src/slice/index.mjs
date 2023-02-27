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

import { readJson, writeJson } from '../shared/filesystem.mjs'
import { removeUnusedSchemas } from '../shared/modules.mjs'

// destructure well-known cli args and alias to variables expected by script
const run = ({
  input: input,
  sdk: sdk,
  output: output
}) => {

  return new Promise( async (resolve, reject) => {
    try {
      const openrpc = await readJson(input)
      const manifest = await readJson(sdk)

      openrpc.info.title = manifest.info.title

      Object.keys(manifest.info).filter(key => key.startsWith('x-')).forEach(extension => {
        openrpc.info[extension] = manifest.info[extension]
      })
    
      const methods = []
      manifest.methods.forEach(rule => {
        const capabilities = method => method.tags && method.tags.find(t => t.name === 'capabilities') || {}
        const uses = method => capabilities(method)['x-uses'] || []
        const provides = method => capabilities(method)['x-provides'] || null
        const manages = method => capabilities(method)['x-manages'] || []

        // TypeError-proof the code below
        rule.use = rule.use || []
        rule.provide = rule.provide || []
        rule.manage = rule.manage || []

        const matchModule = method => rule.module === '*' || method.name.toLowerCase().startsWith(rule.module.toLowerCase())
        const matchUse = method => uses(method).some(cap => rule.use.includes(cap) || rule.use.includes('*'))
        const matchProvide = method => provides(method) && rule.provide.includes(provides(method)) || rule.provide.includes('*')
        const matchManage = method => manages(method).some(cap => rule.manage.includes(cap) || rule.manage.includes('*'))
        const matchCapability = method => (matchUse(method) || matchProvide(method) || matchManage(method))

        const matcher = method => {return matchCapability(method) && matchModule(method)}

        const matches = openrpc.methods.filter(matcher)

        methods.push(...matches)
      })
      openrpc.methods.length = 0
      openrpc.methods.push(...new Set(methods))

      // Tree-shake unused schemas
      openrpc.components = removeUnusedSchemas(openrpc).components
      
      await writeJson(output, openrpc)
      resolve()
    }
    catch (error) {
      throw error
      reject()
    }
  })
}

export default run