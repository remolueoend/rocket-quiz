import args from './args'
import * as fs from 'fs'
import * as pathHelper from 'path'
import { mergeDeepRight } from 'ramda'

export interface AppConfig {
  adapters: {
    'rocketChat': {
      url: string
      username: string
      passwordHash: string
    }
  }
}

export const defaultConfig: AppConfig = {
  adapters: {
    'rocketChat': {
      url:
        'https://please-set-URL-in-app-config-under_adapters.rocket-chat.url',
      username: '',
      passwordHash: '',
    },
  },
}

const configPath = args.config && pathHelper.resolve(args.config)
const appConfig = configPath && fs.accessSync(configPath) && require(configPath)

export default mergeDeepRight(defaultConfig, appConfig)
