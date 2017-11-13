import args from './args'
import * as fs from 'fs'
import * as pathHelper from 'path'
import { mergeDeepRight } from 'ramda'

export interface BaseServiceConfig {
  logLevel: string
}

export interface ChatServiceConfig extends BaseServiceConfig {
  protocol: string
  host: string
  port: number
  username: string
  password: string
  roomName: string
}

export interface BrokerConfig {
  host: string
  vhost: string
  exchangeName: string
}

export interface AppConfig {
  broker: BrokerConfig
  logging: {
    logLevel: string
    logDir: string
  }
  services: {
    [moduleName: string]: any
    messenger: BaseServiceConfig
    chat: ChatServiceConfig
  }
  adapters: {
    rocketChat: {
      url: string
      username: string
      passwordHash: string
    }
  }
}

export const defaultConfig: AppConfig = {
  broker: {
    host: 'amqp://localhost/',
    vhost: '/',
    exchangeName: 'main-exchange',
  },
  logging: {
    logLevel: 'debug',
    logDir: pathHelper.join(__dirname, '../../logs/'),
  },
  services: {
    messenger: {
      logLevel: 'debug',
    },
    chat: {
      logLevel: 'debug',
      protocol: 'http',
      host: 'localhost',
      port: 15673,
      username: 'quiz-bot',
      password: 'quiz-bot_pw',
      roomName: 'quiz',
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
