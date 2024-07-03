import path from 'path'
import { readJson } from './filesystem.mjs'

let config = null

export const loadConfig = async (language) => {
  if (!config) {
    config = await readJson(path.join(language, 'language.config.json'))
  }
  return config
}

export const getConfig = () => {
  if (!config) {
    return null;
  }
  return config
}
