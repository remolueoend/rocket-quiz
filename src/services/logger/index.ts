// Will crash the whole process if an unhandled promise rejection is raised.
process.on('unhandledRejection', error => {
  throw error
})

import { createMessenger, Messenger } from '../../lib/messenger'
import config from '../../lib/config'
import { Logger as WinstonLogger, transports, LoggerInstance } from 'winston'

export interface LogRequestMessage {
  type: string
  content: string
  meta: any[]
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
    this.messenger.listen()
  }

  public handleLogRequest(req: LogRequestMessage) {
    const logFn = (this.winston as any)[req.type]
    if (typeof logFn === 'function') {
      ;(logFn as Function).call(this.winston, req.content, ...req.meta)
    }
  }
}

export const createLoggerService = async () => {
  const messenger = await createMessenger('logger', ['log.#'], config.broker)
  const winston = new WinstonLogger({
    transports: [
      new transports.Console({
        colorize: true,
        prettyPrint: true,
      }),
    ],
  })
  return new LoggerService(messenger, winston)
}

createLoggerService().then(logger => logger.listen())
