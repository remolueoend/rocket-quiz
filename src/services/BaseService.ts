import { Messenger, MethodHandler } from '../lib/messenger'
import * as events from 'events'
import { createLogger, Logger } from '../lib/log'

export class BaseService extends events.EventEmitter {
  public readonly serviceName: string
  protected readonly logger: Logger
  
  constructor(serviceName: string, public readonly messenger: Messenger) {
    super()
    this.serviceName = serviceName
    this.logger = createLogger(this.serviceName)
  }

  public async listen(): Promise<this> {
    await this.messenger.listen()
    this.logger.info('Service listener started.')
    return this
  }

  public onMessage<TContent>(route: string, handler: MethodHandler<TContent>) {
    this.messenger.onMessage(route, handler)
  }
}
