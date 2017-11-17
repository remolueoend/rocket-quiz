// Will crash the whole process if an unhandled promise rejection is raised.
process.on('unhandledRejection', error => {
  throw error
})

import { Message } from 'amqplib'
import { createMessenger, Messenger, Events } from '../../lib/messenger'
import { parseJsonMessage } from '../../lib/message-helpers'
import config from '../../lib/config'
import { Logger as WinstonLogger, transports, LoggerInstance } from 'winston'
import { pick } from 'ramda'

export interface LogRequestMessage {
  level: string
  message: string
  meta?: {}
}

export class LoggerService {
  constructor(
    protected readonly messenger: Messenger,
    protected readonly winston: LoggerInstance,
  ) {}

  public listen() {
    this.messenger.onMessage('log.write', (content, msg) => {
      this.handleLogRequest(content as LogRequestMessage)
    })
    this.messenger.on(Events.message, (msg: Message) => {
      if (msg.fields.routingKey !== 'log.write') {
        this.handleLogRequest({
          level: 'debug',
          message: `message`,
          meta: pick(
            [
              'contentType:',
              'messageId',
              'timestamp',
              'type',
              'appId',
              'replyTo',
              'correlationId',
              'headers',
            ],
            msg.properties,
          ),
        })
      }
    })
    this.messenger.listen()
  }

  public handleLogRequest(req: LogRequestMessage) {
    this.winston.log(req.level, req.message, req.meta)
  }
}

export const createLoggerService = async () => {
  const messenger = await createMessenger('logger', ['#'], config.broker)
  const winston = new WinstonLogger({
    transports: [
      new transports.Console({
        level: 'debug',
        colorize: true,
        prettyPrint: true,
      }),
    ],
  })
  return new LoggerService(messenger, winston)
}

createLoggerService().then(logger => logger.listen())
