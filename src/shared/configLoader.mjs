import path from 'path'
import { readJson } from './filesystem.mjs'

let config = null

export const loadConfig = async (customConfig, language) => {
  if (!config) {
    config = await readJson(path.join(language, 'language.config.json'))

    try {
      const overrideConfig = await readJson(path.join(customConfig, 'language.config.json'))
      config = { ...config, ...overrideConfig }

    } catch (error) {
      console.log(`Custom configuration file not found at ${customConfig}. Falling back to default language configuration.`);
    }
  }
  return config
}

export const getConfig = () => {
  if (!config) {
    return {};
  }
  return config
}
