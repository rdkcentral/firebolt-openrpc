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

const getTemplateForMethod = (method, suffix, templates) => {
  const template = method.tags && method.tags.map(t=>t.name).find(t => Object.keys(templates).includes('methods/' + t + suffix)) || 'default'
  return templates[`methods/${template}${suffix}`]
}

export {
  loadTemplateContent,
  getTemplateForMethod,
}
