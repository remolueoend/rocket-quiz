// Will crash the whole process if an unhandled promise rejection is raised.
process.on('unhandledRejection', error => {
  throw error
})

import { Message } from 'amqplib'
import { createMessenger, Messenger, Events } from '../../lib/messenger'
import { parseJsonMessage } from '../../lib/message-helpers'
import config from '../../lib/config'
import { Logger as WinstonLogger, transports, LoggerInstance } from 'winston'
import { pick, mergeDeepRight } from 'ramda'
import * as pathHelper from 'path'
import { createLogger } from '../../lib/log'
import { BaseService } from '../BaseService'
import { printMsgMeta } from '../../lib/log-formatter'

export interface LogRequestMessage {
  level: string
  message: string
  meta?: {}
}

export class LoggerService extends BaseService {
  constructor(messenger: Messenger) {
    super('logger', messenger)
  }

  protected registerMessageListener() {
    this.messenger.onMessage('log.write', (content, msg) => {
      this.handleLogRequest(content as LogRequestMessage)
    })
    this.messenger.on(Events.message, (msg: Message) => {
      if (msg.fields.routingKey !== 'log.write') {
        this.handleLogRequest({
          level: 'debug',
          message: `tracked message on exchange`,
          meta: printMsgMeta(msg),
        })
      }
    })
  }

  public listen() {
    this.registerMessageListener()
    return super.listen()
  }

  public handleLogRequest(req: LogRequestMessage) {
    this.logger.log(req.level, req.message, req.meta)
  }
}

export const createLoggerService = async () => {
  const messenger = await createMessenger('logger', ['#'], config.broker, {
    //  logger service listens for all routes, so we have to ignore RPC calls for invalid methods:
    ignoreInvalidMethod: true,
  })
  return new LoggerService(messenger)
}

createLoggerService().then(logger => {
  logger.listen()
})
