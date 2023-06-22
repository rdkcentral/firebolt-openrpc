import path from 'path'
import { readFile, writeFile, readdir } from 'fs/promises'
import { lstatSync } from 'fs'
import { emptyDir } from 'fs-extra'
import { mkdirpSync as mkdirSync } from 'fs-extra'

const readText = ref => readFile(ref)
                        .then(resp => resp.toString())

const writeText = (ref, content) => {
    // make sure the directory exists
    mkdirSync(path.dirname(ref), { recursive: true })
    writeFile(ref, content) // this is here to avoid importing fs/promises everywhere...
}
                        
const readJson = ref => readFile(ref)
                            .then(resp => resp.toString())
                            .then(data => JSON.parse(data))

const writeJson = (ref, json) => writeText(ref, JSON.stringify(json, null, '\t'))

const readDir = async (ref, options) => {
    let i = 0
    const isJustAFile = lstatSync(ref).isFile()
    const files = isJustAFile ? [ { name:'', isDirectory: _ => false } ] : await readdir(ref, { withFileTypes: true })
    const results = files.filter(file => !file.isDirectory()).map(file => path.join(ref, file.name))

    if (!options.base) {
        options.base = path.join(ref, '..')
    }
    if (options.recursive) {
        for (var index=files.length-1; index>=0; index--) {

            if (files[index].isDirectory()) {
                results.push(...((await readDir(path.join(ref, files[index].name), options))))
            }
        }
    }

    return results.sort()
}

const binFormats = [ '.png', '.jpg', '.gif' ]

const readFiles = (refs, base) => Promise.all(refs.map(ref => readFile(ref)))
                            .then(contents => {
                                if (!refs || refs.length === 0) {
                                    return Promise.resolve({})
                                }
                                
                                let index = base ? base.length : 0
                                if (base && !refs[0].startsWith(base)) {
                                    refs = refs.map(v => path.relative(base, v))
                                    index = 0
                                }
                                else if (index === 0 && refs.length !== 1) {
                                    // find the common prefix of all the files
                                    while ((new Set(refs.map(r => r[index]))).size === 1) {
                                        index++
                                    }

                                    // back up one dirctory from the common prefix
                                    index = path.join(path.join(refs[0].substring(0, index)), '..').length
                                }

                                const results = refs.map(v => [v.substring(index), null])
                                for (let i=0; i<refs.length; i++) {
                                    if (binFormats.find(suffix => refs[i].endsWith(suffix))) {
                                        results[i][1] = contents[i]
                                    }
                                    else {
                                        results[i][1] = contents[i].toString()
                                    }
                                }
                                return Promise.resolve(Object.fromEntries(results))
                            })

const writeFiles = (files) => {
    // make all of the dirs
    Object.keys(files).map(file => mkdirSync(path.dirname(file), { recursive: true }))

    return Promise.all(Object.entries(files)
            .map( ([file, contents]) => writeText(file, contents)))
}

export {
    readText,
    writeText,
    readJson,
    writeJson,
    readDir,
    readFiles,
    writeFiles,
    emptyDir
}