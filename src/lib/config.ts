import args from './args'
import * as fs from 'fs'
import * as pathHelper from 'path'
import { mergeDeepRight } from 'ramda'

export interface BaseModuleConfig {
  logLevel: string
}

export interface AppConfig {
  logging: {
    logLevel: string
    logDir: string
  }
  modules: {
    [moduleName: string]: BaseModuleConfig
    messenger: BaseModuleConfig
  }
  adapters: {
    rocketChat: {
      url: string
      username: string
      passwordHash: string
    }
  }
}

debugger
export const defaultConfig: AppConfig = {
  logging: {
    logLevel: 'debug',
    logDir: pathHelper.join(__dirname, '../../logs/'),
  },
  modules: {
    messenger: {
      logLevel: 'debug',
    },
  },
  adapters: {
    rocketChat: {
      url:
        'https://please-set-URL-in-app-config-under_adapters.rocket-chat.url',
      username: '',
      passwordHash: '',
    },
  },
}

const configPath = args.config && pathHelper.resolve(args.config)
let appConfig: AppConfig

if (configPath) {
  fs.accessSync(configPath)
  appConfig = mergeDeepRight(defaultConfig, require(configPath))
} else {
  appConfig = defaultConfig
}

export default appConfig
