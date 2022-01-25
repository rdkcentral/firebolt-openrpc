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

import { getMarkdown, getAllMarkdownNames } from './descriptions.mjs'

test('proving that getMarkdown is untestable', () => {
  // This function mutates a variable in the function's global scope and performs side-effects on it.
  // Unless we setup the entire scenario around this, all we're testing is that a feature of
  // the javascript syntax works. description[name].
  expect(getMarkdown('foo')).toBeUndefined()
})

test('and by extension, so is getAllMarkdowns', () => {
  // Yay, we have tested that Object.keys works as described
  expect(getAllMarkdownNames('blah')).toStrictEqual([])
})
