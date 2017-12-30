import config, { BrokerConfig } from './config'
import { Logger as WinstonLogger, transports, TransportInstance } from 'winston'
const Transport = require('winston-transport')
import * as Winston from 'winston'
import { Messenger, createMessenger } from './messenger'
import { createGenericMessage } from './message-helpers'
import { isDevelopment } from './env'

export type Logger = Winston.LoggerInstance

export interface RabbitMQTransportOpts {
  broker: BrokerConfig
  serviceName: string
}

export class RabbitMQTransport extends (Transport as {
  new (opts: {}): TransportInstance
}) {
  public readonly brokerOpts: BrokerConfig
  public readonly serviceName: string
  protected readonly getMessenger: PromiseLike<Messenger>

  constructor(opts: RabbitMQTransportOpts) {
    super(opts)
    this.brokerOpts = opts.broker
    this.serviceName = opts.serviceName
    this.getMessenger = createMessenger(this.serviceName, [], this.brokerOpts)
  }

  log(level: any, message: string, meta: {}, callback: () => void) {
    this.getMessenger.then(messenger => {
      messenger.sendToExchange(
        'log.write',
        createGenericMessage({ level, message, meta }),
      )
      callback && callback()
    })
  }
}

export const getLogLevel = (moduleName: string) =>
  (config.services[moduleName] && config.services[moduleName].logLevel) ||
  config.logging.logLevel

export const createLogger = (serviceName: string) => {
  const logTransports: TransportInstance[] = isDevelopment
    ? [
        new transports.Console({
          json: process.env['LOG_FORMAT'] === 'json',
          label: serviceName,
          level: (config.services[serviceName] || {}).logLevel || 'info',
          colorize: false,
          prettyPrint: false,
          handleExceptions: true,
          humanReadableUnhandledException: false,
          stringify: true,
        }),
      ]
    : [
        new transports.File({
          json: false,
          prettyPrint: true,
          dirname: config.logging.logDir,
          filename: 'runtime.log',
          handleExceptions: true,
          humanReadableUnhandledException: true,
        }),
      ]
  /*new RabbitMQTransport({
      broker: config.broker,
      serviceName,
    }), */
  return new WinstonLogger({
    level: getLogLevel(serviceName),
    transports: logTransports,
  })
}

export default createLogger
