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

const tag = (method, name) => method.tags.find(tag => tag.name === name)
export const capabilities = method => tag(method, 'capabilities')
export const isProvider = method => capabilities(method)['x-provides']
export const isPusher = method => capabilities(method)['x-push']
export const isNotifier = method => method.tags.find(t => t.name === 'notifier')
export const isEvent = method => tag(method, 'event')

export const name = method => method.name.split('.').pop()
export const rename = (method, renamer) => method.name.split('.').map((x, i, arr) => i === (arr.length-1) ? renamer(x) : x).join('.')

export const getNotifier = (method, client) => client.methods.find(m => m.name === method.tags.find(t => t.name === "event")['x-notifier'])
export const getEvent = (method, server) => server.methods.find(m => m.name === method.tags.find(t => t.name === "notifier")['x-event'])