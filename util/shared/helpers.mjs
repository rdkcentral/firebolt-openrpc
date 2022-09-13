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
import fse from 'fs-extra'
import path from 'path'
import getPathOr from 'crocks/helpers/getPathOr.js'
import { getSchema, removeIgnoredAdditionalItems, replaceUri } from './json-schema.mjs'
import { fireboltize } from '../shared/modules.mjs'
import { getExternalMarkdownPaths } from '../shared/json-schema.mjs'
import or from 'crocks/logic/or.js'
import not from 'crocks/logic/not.js'
import https from 'https'

const {
  mkdir,
  writeFile,
  readFile, // NOTE: This explicit casing is _required_
  copyFile, // NOTE: This explicit casing is _required_
  rmdir,
  rm,
  stat
} = fs

const {
  copy
} = fse

const fsStat = h.wrapCallback(stat)
const fsCopyFile = h.wrapCallback(copyFile)
const fsCopy = h.wrapCallback(copy)
const fsMkDirP = h.wrapCallback((path, cb) => mkdir(path, { recursive: true }, cb))
const fsRemoveDirectory = h.wrapCallback(rmdir)
const fsRemoveFile = h.wrapCallback(rm)
const fsWriteFile = h.wrapCallback(writeFile)
const fsReadFile = h.wrapCallback(readFile)
const bufferToString = buf => buf.toString()

const copyDirectory = dir => h.wrapCallback(copy)
const clearDirectory = dir => fsRemoveDirectory(dir, {recursive: true})
const isFile = dir => fsStat(dir).map(statObj => statObj.isFile())

const logSuccess = message => console.log(`\x1b[32m ✓ \x1b[0m\x1b[2m ${message}\x1b[0m`)
const logError = message => console.log(`\x1b[31m ✗ \x1b[0m\x1b[2m ${message}\x1b[0m`)
const logInfo = message => console.log(`\x1b[38;5;202m ⓘ \x1b[0m\x1b[2m ${message}\x1b[0m`)

const logHeader = message => console.log(`\x1b[0m\x1b[7m\x1b[32m${message}\x1b[0m\n`)

// TODO: Convert to "stream" style fs functions
const recursiveFileDirectoryList = dirOrFile => {
  return h((push, next) => {
    if (!dirOrFile) {
      push(null, h.nil)
      return
    }
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

const removeFileAndParentIfEmpty = file => fsRemoveFile(file).flatMap(_ => h(removeParentDirIfEmpty(file)))

const removeParentDirIfEmpty = file => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(file)
    fs.stat(dir, (err, stat) => {
      if (stat && !stat.isFile()) {
        fs.readdir(dir, (err, files) => {
          if (files.length === 0) {
            rmdir(dir, { recursive: true }, err => {
              if (err) {
                reject(err)
              }
              else {
                resolve()
              }
            })
          }
          else {
            resolve()
          }
        })
      }
      else {
        resolve()
      }
    })  
  })
}


const treeShakeDirectory = (baseUrl, entryPoint) => {
  return h(new Promise((resolve, reject) => {
    treeShakenFileList(baseUrl, entryPoint).then(keep => {
      recursiveFileDirectoryList(baseUrl)
        .filter(file => file.endsWith('.js') || file.endsWith('.mjs'))
        .filter(file => !keep.includes(file))
        .tap(file => logInfo(`Tree-shaking: ${trimPath(file)} from build.`))
        .flatMap(removeFileAndParentIfEmpty)
        .collect()
        .tap(_ => resolve())
        .done(_ => {})
    })
  }))
}

const importedFiles = code => Array.from(new Set([...code.matchAll(/(import|export).*?from\s+['"](.*?)['"]/g)].map(arr => arr[2])))

const treeShakenFileList = (baseUrl, entryPoint, list=[]) => {
  const file = path.join(baseUrl, entryPoint)
  baseUrl = path.dirname(file)
  entryPoint = path.basename(file)

  list.push(file)

  return new Promise( (resolve, reject) => {
    readFile(path.join(baseUrl, entryPoint), (err, data) => {
      if (data) {
        const imports = importedFiles(bufferToString(data))
        const newImports = imports.filter(i => !list.includes(i))
        list.push(...newImports)
        return Promise.all(newImports.map(i => treeShakenFileList(baseUrl, i, list).then(moreImports => list.push(...moreImports))))
          .then(_ => { resolve(Array.from(new Set(list)).sort())})
      }
      else {
        reject(err)
      }
    })
  })
}



// A through stream that expects a stream of filepaths, reads the contents
// of any .suffix files found, and converts them to an array tuple that
// has the filepath and the contents of the file.
// DOES NOT DEAL WITH ERRORS
const loadFileContent = suffix => fileStream => fileStream
  .filter(filepath => ((path.extname(filepath) === suffix) || (suffix.includes && suffix.includes(path.extname(filepath)))))
  .flatMap(filepath => fsReadFile(filepath)
    .map(buf => [filepath, bufferToString(buf)]))

const readUrl = url => h((push) => {
  https.get(url, res => {
    res.on('data', chunk => push(null, chunk))
    res.on('end', () => push(null, h.nil))
  })
})
.collect()
.map(Buffer.concat)
  
const loadUrlContent = url => {
  return readUrl(url)
    .map(buf => [url, bufferToString(buf)])
}
  

const jsonErrorHandler = filepath => (err, push) => {
  console.error(`\n\u{1F494} Error: ${filepath}\n`)
  if (/JSON/.test(err.message)) {
    console.error('There was an error loading a .json file. Unable to continue.')
    console.error(err)
    process.exit(1)
  } else {
    push(err)
  }
}

const parseVersion = json => {
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
}

// example:
// '1.0.0-beta.1' 
const loadVersion = path => loadJson(path)
  .map(parseVersion)

const loadJson = path => fsReadFile(path)
  .map(bufferToString)
  .map(JSON.parse)

const getFilename = (json, asPath) => (json.info ? json.info.title : (asPath ? json.title : json.title + 'Schema'))
const getDirectory = (json, asPath) => asPath ? json.info ? '' : 'schemas' : ''
const getLinkFromRef = (ref, schemas = {}, asPath) => path.join((asPath ? 'schemas' : ''), getFilename(getSchema(ref.split('#')[0], schemas), asPath)) + (ref.includes('#') ? '#' + ref.split('#')[1] : '')

// Extracted function for the common pattern of building an object of
// file path keys and file content values. truncateBefore removes the
// part of the full path before and including truncateBefore's value.
const fileCollectionReducer = (truncateBefore = '') => (acc = {}, payload = '') => {
  const [filepath, data] = payload
  if (truncateBefore !== '') {
    // If we can't find truncateBefore path, try backslashes in case windows.
    // Probably a better way to do this with the path library, but this works.
    let tb = filepath.indexOf(truncateBefore) !== -1 ? truncateBefore : truncateBefore.replace(/\//g, '\\')
    const pieces = filepath.split(tb)
    const truncatedFilepath = pieces[1]
    if (truncatedFilepath) {
      acc[truncatedFilepath.replace(/\\/g, '/')] = data
    }
  } else {
    acc[filepath.replace(/\\/g, '/')] = data
  }
  return acc
}

const hasPublicInterfaces = json => json.methods && json.methods.filter(m => m.tags && m.tags.find(t=>t['x-provides'])).length > 0
const hasPublicMethods = json => hasPublicInterfaces(json) || (json.methods && json.methods.filter(m => !m.tags || !m.tags.map(t=>t.name).includes('rpc-only')).length > 0)
const alphabeticalSorter = (a, b) => a.info.title > b.info.title ? 1 : b.info.title > a.info.title ? -1 : 0
const combineStreamObjects = (...xs) => h([...xs]).flatten().collect().map(xs => Object.assign({}, ...xs))
const schemaMapper = ([_filepath, parsed]) => {
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

const loadFilesIntoObject = (folder = '', ext = '.json', truncateBefore = '') => recursiveFileDirectoryList(folder)
  .flatFilter(isFile)
  .through(loadFileContent(ext))
  .reduce({}, fileCollectionReducer(truncateBefore))

const externalMarkdownDescriptions = markdownFolder => recursiveFileDirectoryList(markdownFolder)
  .flatFilter(isFile)
  .through(loadFileContent('.md'))
  .reduce({}, fileCollectionReducer('/src/'))

const schemaFetcher = uri => loadSchema(uri)
    .flatMap(([file, contents]) => h.of(contents)
      .map(JSON.parse)
      .tap(removeIgnoredAdditionalItems)
      .tap(schema => replaceUri('https://raw.githubusercontent.com/json-schema-tools/meta-schema/1.5.9/src/schema.json', 'https://meta.json-schema.tools/', schema))
      .errors(jsonErrorHandler(file))
      .map(parsed => schemaMapper([file, parsed])))
    .reduce({}, fileCollectionReducer())

const loadSchema = uri => {
  if (uri.startsWith('http') || uri.startsWith('https')) {
    return loadUrlContent(uri)
  }
  else {
    return recursiveFileDirectoryList(uri)
    .flatFilter(isFile)
    .through(loadFileContent('.json'))
  }
}

const localModules = (modulesFolder = '', markdownFolder = '', disableTransforms = false, filterPrivateModules = true) => {
  const isFlagSet = (_) => filterPrivateModules // Makes this impure on purpose b/c our flag lives outside the context of the filter and sometimes, we want to override the filter.
  return recursiveFileDirectoryList(modulesFolder)
    .flatFilter(isFile)
    .through(loadFileContent('.json'))
    .flatMap(([filepath, data]) => h.of(data)
      .map(JSON.parse)
      .errors(jsonErrorHandler(filepath))
      .flatMap(obj => {
        if (disableTransforms) {
          return h.of(obj)
        }
        return h.of(obj)
          .map(fireboltize)
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

  const trimPath = file => path.relative(process.cwd(), file)

export {
  loadFilesIntoObject,
  schemaFetcher,
  localModules,
  combineStreamObjects,
  jsonErrorHandler,
  bufferToString,
  clearDirectory,
  treeShakenFileList,
  treeShakeDirectory,
  loadVersion,
  loadJson,
  fsMkDirP,
  fsCopy,
  fsCopyFile,
  fsWriteFile,
  fsReadFile,
  logSuccess,
  logError,
  logHeader,
  getFilename,
  getDirectory,
  getLinkFromRef,
  trimPath
}
