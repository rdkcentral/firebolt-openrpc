import path from 'path'
import { readJson } from './filesystem.mjs'

import { logInfo, logSuccess } from './io.mjs'

let config = null

export const readConfigFile = async (customConfig, language) => {
    let result = await readJson(path.join(language, 'language.config.json'))

    try {
      const overrideConfig = await readJson(path.join(customConfig, 'language.config.json'))
      result = { ...result, ...overrideConfig }
      logSuccess(`Override default language configuration from ${customConfig}`);
    } catch (error) {
      logInfo(`Custom language configuration not found at ${customConfig}. Falling back to default configuration.`);
    }
  return result
}

export const loadConfig = async (customConfig, language) => {
  if (!config) {
    config = await readConfigFile(customConfig, language)
  }
  return config
}

export const getConfig = () => {
  if (!config) {
    return {};
  }
  return config
}
