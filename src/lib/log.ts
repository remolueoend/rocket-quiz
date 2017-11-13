import config from './config'
import { Logger, transports } from 'winston'
import * as pathHelper from 'path'

export const getLogLevel = (moduleName: string) =>
  (config.services[moduleName] && config.services[moduleName].logLevel) ||
  config.logging.logLevel

export const createLogger = (moduleName: string) =>
  new Logger({
    level: getLogLevel(moduleName),
    transports: [
      new transports.File({
        colorize: true,
        prettyPrint: true,
        label: moduleName,
        filename: pathHelper.join(config.logging.logDir, 'runtime.log'),
        tailable: false,
      }),
    ],
  })

export default createLogger
