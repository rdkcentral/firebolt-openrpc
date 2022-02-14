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

import { fsReadFile, bufferToString } from './helpers.mjs'
import path from 'path'

const templates = {}

// A through stream that expects a stream of filepaths, reads the contents
// of any .json files found, and converts them to POJOs
// DOES NOT DEAL WITH ERRORS
const loadTemplateContent = (pathDelimiter, suffix) => fileStream => fileStream
    .filter(filepath => path.extname(filepath) === suffix)
    .flatMap(filepath => {
        return fsReadFile(filepath)
            .map(bufferToString)
            .tap(data => templates[filepath.split(pathDelimiter)[1]] = data)
    })

const getTemplate = name => templates[name]

const getTemplateForMethod = (method, suffix) => {
    const template = method.tags && method.tags.map(t=>t.name).find(t => getAllTemplateNames().includes('methods/' + t + suffix)) || 'default'
    return getTemplate(`methods/${template}${suffix}`)
}

const getAllTemplateNames = _ => Object.keys(templates)

export {
    loadTemplateContent,
    getTemplate,
    getTemplateForMethod,
    getAllTemplateNames,
}
