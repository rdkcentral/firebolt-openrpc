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

import h from 'highland'
import fs from 'fs'
import path from 'path'
import getPathOr from 'crocks/helpers/getPathOr.js'
import { getSchema } from './json-schema.mjs'
import { generatePropertyEvents, generatePropertySetters, generatePolymorphicPullEvents } from '../shared/modules.mjs'
import { getExternalMarkdownPaths } from '../shared/json-schema.mjs'
import or from 'crocks/logic/or.js'
import not from 'crocks/logic/not.js'

const {
  access,
  mkdir,
  writeFile,
  readFile, // NOTE: This explicit casing is _required_
  copyFile, // NOTE: This explicit casing is _required_
  readdir,
  rmdir,
  stat
} = fs

const fsStat = h.wrapCallback(stat)
const fsAccess = h.wrapCallback(access)
const fsCopyFile = h.wrapCallback(copyFile)
const fsMkDir = h.wrapCallback(mkdir)
const fsMkDirP = h.wrapCallback((path, cb) => mkdir(path, { recursive: true }, cb))
const fsRemoveDirectory = h.wrapCallback(rmdir)
const fsWriteFile = h.wrapCallback(writeFile)
const fsReadDir = h.wrapCallback(readdir)
const fsReadFile = h.wrapCallback(readFile)
const bufferToString = buf => buf.toString()

const clearDirectory = dir => fsRemoveDirectory(dir, {recursive: true})
const isDirectory = dir => fsStat(dir).map(statObj => statObj.isDirectory())
const isFile = dir => fsStat(dir).map(statObj => statObj.isFile())
const isPublicModule = dir => dir.split('/').pop()[0] !== '_'
const relativePath = from => to => path.relative(from, to)
const fileContent = file => fsReadFile(file).map(bufferToString)

const logSuccess = message => console.log(`\x1b[32m ✓ \x1b[0m\x1b[2m ${message}\x1b[0m`)
const logHeader = message => console.log(`\x1b[0m\x1b[7m\x1b[32m${message}\x1b[0m\n`)

// TODO: Convert to "stream" style fs functions
const recursiveFileDirectoryList = dirOrFile => {
  return h((push, next) => {
    fs.stat(dirOrFile, (err, stat) => {
      if (!stat || stat.isFile()) {
        stat && push(err, dirOrFile)
        push(null, h.nil)
      } else {
        // Add the directory itself to the ouput stream.
        push(null, dirOrFile)
        fs.readdir(dirOrFile, (_err, files) => {
          next(h(files)
            .map(file => {
              file = path.join(dirOrFile, file)
              return recursiveFileDirectoryList(file)
            })
            .merge()
          )
        })
      }
    })
  })
}

// A through stream that expects a stream of filepaths, reads the contents
// of any .suffix files found, and converts them to an array tuple that
// has the filepath and the contents of the file.
// DOES NOT DEAL WITH ERRORS
const loadFileContent = suffix => fileStream => fileStream
  .filter(filepath => path.extname(filepath) === suffix)
  .flatMap(filepath => fsReadFile(filepath)
    .map(buf => [filepath, bufferToString(buf)])
  )

// example:
// '1.0.0-beta.1' 
const loadVersion = path => fsReadFile(path)
  .map(bufferToString)
  .map(JSON.parse)
  .map(json => {
    const x = json.version.split('-').map(x => x.split('.'))
    const v = {
      major: x[0][0],
      minor: x[0][1],
      patch: x[0][2]
    }

    // grab description
    v.readable = json.description

    if (x.length === 2) {
      const tag = x[1][0][0].toUpperCase() + x[1][0].substr(1)
      const build = x[1][1]
      v.readable += ` [${tag} ${build}]`
    }

    v.original = json.version
    
    return v
  })

// Can be used with `flatFilter` to skip existing files.
// TODO: I think this logic is reversed.
const fileExists = file => fsAccess(file)
  .errors((err, push) => {
    if (err && err.code === 'ENOENT') {
      push(null, true)
    } else {
      push(err)
    }
  })

const createFilesAbsentInDir = (files, dir, referenceFolder) => h(files)
  .map(toGenerate => path.join(dir, toGenerate))
  .flatFilter(fileExists)
  .flatMap(file => {
    const fallback = path.join(referenceFolder, path.basename(file))
    return fsReadFile(fallback)
      .flatMap(buff => fsWriteFile(file, buff))
      .map(_ => file)
  })

const createDirAbsentInDir = dir => h.of(dir)
  .flatMap(x => fsMkDir(x).errors((err, push) => {
    if (err.code === 'EEXIST') {
    } else {
      push(err)
    }
  })
  .map(_ => x)
)

// TODO: Make this and copyReferenceFileToTarget a single function
const copyReferenceDirToTarget = (reference, target) => dir => {
  const folderToCreate = path.join(target, relativePath(reference)(dir))
  return fsMkDir(folderToCreate, {recursive: true})
    .map(_ => folderToCreate)
}

const copyReferenceFileToTarget = (reference, target) => file => {
  const destination = path.join(target, relativePath(reference)(file))
  return fsCopyFile(file, destination)
    .map(_ => destination)
}

const getModuleName = obj => h.of(obj)
  .map(getPathOr(null, ['info', 'title']))
  .compact()

const gatherStateForInsertMacros = referenceFolder => ([macros, obj]) => getModuleName(obj)
  .flatMap(moduleName => fsReadDir(path.join(referenceFolder, moduleName))
    .sequence()
    .map(file => path.join(referenceFolder, moduleName, file))
  )
  .flatMap(file => fileContent(file)
    .map(fContents => [file, fContents, macros, obj])
)

const getTitle = json => json.info ? json.info.title : json.title
const getFilename = (json, asPath) => (json.info ? json.info.title : (asPath ? json.title : json.title + 'Schema'))
const getDirectory = (json, asPath) => asPath ? json.info ? '' : 'schemas' : ''
const getLinkFromRef = (ref, schemas = {}, asPath) => path.join((asPath ? 'schemas' : ''), getFilename(getSchema(ref.split('#')[0], schemas), asPath)) + (ref.includes('#') ? '#' + ref.split('#')[1] : '')

// Extracted function for the common pattern of building an object of
// file path keys and file content values. truncateBefore removes the
// part of the full path before and including truncateBefore's value.
const fileCollectionReducer = (truncateBefore = '') => (acc = {}, payload = '') => {
  const [filepath, data] = payload
  if (truncateBefore !== '') {
    const pieces = filepath.split(truncateBefore)
    const truncatedFilepath = pieces[1]
    acc[truncatedFilepath] = data
  } else {
    acc[filepath] = data
  }
  return acc
}

const hasPublicMethods = json => json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0
const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
const markdownFileReducer = fileCollectionReducer('/template/markdown/')
const combineStreamObjects = (...xs) => h([...xs]).flatten().collect().map(xs => Object.assign({}, ...xs))
const schemaMapper = ([_filepath, data]) => {
  const parsed = JSON.parse(data)
  if (parsed && parsed.$id) {
    return  [parsed.$id, parsed]
  }
}

const addExternalMarkdown = (paths = [], data = {}, descriptions = {}) => {
  paths.map(path => {
    const urn = getPathOr(null, path, data)
    const url = urn.indexOf("file:../") == 0 ? urn.substr("file:../".length) : urn.substr("file:".length)
    const markdownContent = descriptions[url]
    path.pop() // last element is expected to be `$ref`
    const field = path.pop() // relies on this position being the field name
    const objectNode = getPathOr(null, path, data)
    objectNode[field] = markdownContent // This mutates `data` by reference because JavaScript!
  })
  return data
}

const templateFetcher = folder => recursiveFileDirectoryList(folder)
  .flatFilter(isFile)
  .through(loadFileContent('.md'))
  .reduce({}, markdownFileReducer)

const externalMarkdownDescriptions = markdownFolder => recursiveFileDirectoryList(markdownFolder)
  .flatFilter(isFile)
  .through(loadFileContent('.md'))
  .reduce({}, fileCollectionReducer('/src/'))

// TODO: Add error handling back to json docs.
const schemaFetcher = folder => recursiveFileDirectoryList(folder)
  .flatFilter(isFile)
  .through(loadFileContent('.json'))
  .map(schemaMapper)
  .reduce({}, fileCollectionReducer())

const localModules = (modulesFolder = '', markdownFolder = '', disableTransforms = false, filterPrivateModules = true) => {
  const isFlagSet = (_) => filterPrivateModules // Makes this impure on purpose b/c our flag lives outside the context of the filter and sometimes, we want to override the filter.
  return recursiveFileDirectoryList(modulesFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.json'))
    .flatMap(([filepath, data]) => h.of(data)
      .map(JSON.parse)
      .flatMap(obj => {
        if (disableTransforms) {
          return h.of(obj)
        }
        return h.of(obj)
          .map(generatePropertyEvents)
          .map(generatePropertySetters)
          .map(generatePolymorphicPullEvents)
      })
      .filter(or(not(isFlagSet), hasPublicMethods)) // allows the validator to validate private modules
      .sortBy(alphabeticalSorter)
      .map(transformedData => [filepath, transformedData])
    )
    .flatMap(payload => {
      const [filepath, data] = payload
      const paths = getExternalMarkdownPaths(data)
      // Note that this only evaluates descriptions if there are any to replace in the module.
      if (paths.length > 0) {
        return externalMarkdownDescriptions(markdownFolder)
          .map(descriptions => addExternalMarkdown(paths, data, descriptions))
          .map(withExternalMarkdown => [filepath, withExternalMarkdown])
      } else {
        // Nothing to replace
        return h.of(payload)
      }
    })
    .reduce({}, fileCollectionReducer('/modules/'))
  }

export {
  templateFetcher,
  externalMarkdownDescriptions,
  schemaFetcher,
  localModules,
  combineStreamObjects,
  bufferToString,
  recursiveFileDirectoryList,
  clearDirectory,
  loadVersion,
  loadFileContent,
  getModuleName,
  fileContent,
  fileExists,
  isDirectory,
  isFile,
  isPublicModule,
  fileCollectionReducer,
  fsStat,
  fsMkDir,
  fsMkDirP,
  fsReadDir,
  fsCopyFile,
  fsWriteFile,
  fsRemoveDirectory,
  fsReadFile,
  createFilesAbsentInDir,
  createDirAbsentInDir,
  gatherStateForInsertMacros,
  relativePath,
  copyReferenceFileToTarget,
  copyReferenceDirToTarget,
  logSuccess,
  logHeader,
  getTitle,
  getFilename,
  getDirectory,
  getLinkFromRef
}
