import { Messenger, MethodHandler } from '../lib/messenger'
import * as events from 'events'

export class BaseService extends events.EventEmitter {
  constructor(public readonly messenger: Messenger) {
    super()
  }

  public async listen(): Promise<this> {
    await this.messenger.listen()
    return this
  }

  public onMessage<TContent>(route: string, handler: MethodHandler<TContent>) {
    this.messenger.onMessage(route, handler)
  }
}
