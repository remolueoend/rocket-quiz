import config, { BrokerConfig } from './config'
import { Logger as WinstonLogger, transports, TransportInstance } from 'winston'
const Transport = require('winston-transport')
import * as Winston from 'winston'
import * as pathHelper from 'path'
import { Messenger, createMessenger } from './messenger'
import { createGenericMessage } from './message-helpers'

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
      messenger.sendToExchange('log.write', createGenericMessage({ level, message, meta }))
      debugger
      callback && callback()
    })
  }
}

export const getLogLevel = (moduleName: string) =>
  (config.services[moduleName] && config.services[moduleName].logLevel) ||
  config.logging.logLevel

export const createLogger = (serviceName: string) =>
  new WinstonLogger({
    level: getLogLevel(serviceName),
    transports: [
      new RabbitMQTransport({
        broker: config.broker,
        serviceName,
      }),
      new transports.File({
        colorize: true,
        prettyPrint: true,
        label: serviceName,
        filename: pathHelper.join(config.logging.logDir, 'runtime.log'),
        tailable: false,
      }),
    ],
  })

export default createLogger
