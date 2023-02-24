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
import { addExternalMarkdown, fireboltize } from "../shared/modules.mjs"
import { getExternalSchemas, removeIgnoredAdditionalItems, replaceRef, replaceUri } from "../shared/json-schema.mjs"
import { validate, displayError } from "./validator/index.mjs"
import { logHeader, logSuccess, logError } from "../shared/io.mjs"

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import url from "url"
import path from "path"
import fetch from "node-fetch"

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

const run = async ({
    input: input,
    schemas: schemas,
    transformations = false
}) => {

    logHeader(`Validating ${path.relative('.', input)} with${transformations ? '' : 'out'} Firebolt transformations.`)

    let invalidResults = 0

    const printResult = (result, moduleType) => {
        if (result.valid) {
            logSuccess(`${moduleType}: ${result.title} is valid`)
        } else {
            invalidResults++
            logError(`${moduleType}: ${result.title} failed validation with ${result.errors.length} errors:\n`)

            result.errors.forEach(error => {
                displayError(error)
            })
        }
    }

    const fireboltOpenRpcSpec = await readJson(path.join(__dirname, '..', 'firebolt-openrpc.json'))
    const sharedSchemaList = schemas ? (await Promise.all(schemas.map(d => readDir(d, { recursive: true })))).flat() : []
    const sharedSchemas = await readFiles(sharedSchemaList)

    Object.entries(sharedSchemas).forEach(([path, schema]) => {
        const json = JSON.parse(schema)
        const id = json.$id
        sharedSchemas[id] = json
        delete sharedSchemas[path]
    })

    const moduleList = input ? await readDir(path.join(input), { recursive: true }) : []
    const modules = await readFiles(moduleList, path.join(input))

    const descriptionsList = transformations ? await readDir(path.join(input, '..', 'descriptions'), { recursive: true }) : []
    const markdown = await readFiles(descriptionsList, path.join(input, '..', 'descriptions'))

    const jsonSchemaSpec = await (await fetch('https://meta.json-schema.tools')).json()

    //  - OpenRPC uses `additionalItems` when `items` is not an array of schemas. This fails strict validate, so we remove it
    //  - OpenRPC uses raw.githubusercontent.com URLs for the json-schema spec, we replace this with the up to date spec on meta.json-schema.tools
    const openRpcSpec = await (await fetch('https://meta.open-rpc.org')).json()
    removeIgnoredAdditionalItems(openRpcSpec)
    replaceUri('https://raw.githubusercontent.com/json-schema-tools/meta-schema/1.5.9/src/schema.json', 'https://meta.json-schema.tools/', openRpcSpec)

    Object.values(sharedSchemas).forEach(schema => {
        try {
            new Ajv({ schemas: [schema] })
            // this is too chatty, so leaving it silent.
            // logSuccess(`Compiled schema ${schema.$id}`)
        }
        catch (error) {
            logError(`Schema: ${schema.$id} failed to compile:\n`)
            error.document = schema.$id
            error.source = 'ajv compiler'
            displayError(error)
            invalidResults++
        }
    })

    // Set up the ajv instance
    const ajv = new Ajv({
        schemas: [
            jsonSchemaSpec,
            openRpcSpec,
            fireboltOpenRpcSpec,
            ...Object.values(sharedSchemas)
        ]
    })


    addFormats(ajv)
    // explicitly add our custom extensions so we can keep strict mode on (TODO: put these in a JSON config?)
    ajv.addVocabulary(['x-method', 'x-this-param', 'x-additional-params'])

    const firebolt = ajv.compile(fireboltOpenRpcSpec)
    const jsonschema = ajv.compile(jsonSchemaSpec)
    const openrpc = ajv.compile(openRpcSpec)

    // Validate all shared schemas
    sharedSchemas && Object.keys(sharedSchemas).forEach(key => {
        const json = sharedSchemas[key]
        let result = validate(json, {}, ajv, jsonschema)
        printResult(result, "JSON Schema")
    })

    // Validate all modules
    Object.keys(modules).forEach(key => {
        let json = JSON.parse(modules[key])

        if (transformations) {
            // Do the firebolt API magic
            json = fireboltize(json)

            // pull in external markdown files for descriptions
            json = addExternalMarkdown(json, markdown)

            // Make sure we have a place to drop shared schemas
            json.components = json.components || {}
            json.components.schemas = json.components.schemas || {}

            // add externally referenced schemas that are in our shared schemas path
            const externalSchemas = getExternalSchemas(json, sharedSchemas)
            Object.entries(externalSchemas).forEach(([name, schema]) => {
                // if this schema is a child of some other schema that will be copied in this batch, then skip it
                if (Object.keys(externalSchemas).find(s => name.startsWith(s + '/') && s.length < name.length)) {
                    return
                }
                json.components.schemas[name.split("/").pop()] = schema
            })

            // update references to external schemas to be local
            Object.keys(externalSchemas).forEach(ref => {
                replaceRef(ref, `#/components/schemas/${ref.split("#").pop().substring('/definitions/'.length)}`, json)
            })
        }

        try {
            const openrpcResult = validate(json, {}, ajv, openrpc)
            const fireboltResult = validate(json, {}, ajv, firebolt)

            if (openrpcResult.valid && fireboltResult.valid) {
                printResult(openrpcResult, "OpenRPC & Firebolt")
            }
            else {
                printResult(openrpcResult, "OpenRPC")
                printResult(fireboltResult, "Firebolt")
            }
        }
        catch (error) {
            throw error
        }
    })

    if (invalidResults) {
        console.error(`\nExiting due to ${invalidResults} invalid document${invalidResults === 1 ? '' : 's'}.\n`)
        process.exit(-1)
    }
    return Promise.resolve()
}

export default run