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
import * as pathHelper from 'path'
import { createLogger } from '../../lib/log'

export interface LogRequestMessage {
  level: string
  message: string
  meta?: {}
}

export class LoggerService {
  constructor(
    protected readonly messenger: Messenger,
    protected readonly logger: LoggerInstance,
  ) {}

  public listen() {
    this.messenger.onMessage('log.write', (content, msg) => {
      this.handleLogRequest(content as LogRequestMessage)
    })
    this.messenger.on(Events.message, (msg: Message) => {
      if (msg.fields.routingKey !== 'log.write') {
        this.handleLogRequest({
          level: 'debug',
          message: `message tracked on route "${msg.fields.routingKey}"`,
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

    this.logger.log('debug', 'Listener started.')
  }

  public handleLogRequest(req: LogRequestMessage) {
    this.logger.log(req.level, req.message, req.meta)
  }
}

export const createLoggerService = async () => {
  const messenger = await createMessenger('logger', ['#'], config.broker)
  return new LoggerService(messenger, createLogger('logger'))
}

createLoggerService().then(logger => {
  logger.listen()
})
