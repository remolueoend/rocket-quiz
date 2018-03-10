import { Messenger, MethodHandler } from '../lib/messenger'
import * as events from 'events'
import { createLogger, Logger } from '../lib/log'
import * as joi from 'joi'

export type JsonMessageValidation<TContent> =
  | joi.SchemaLike
  | ((
      content: TContent,
    ) =>
      | joi.ValidationResult<TContent>
      | Promise<joi.ValidationResult<TContent>>)

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

  protected validateMessage<T>(
    content: T,
    validation: JsonMessageValidation<T>,
  ): Promise<joi.ValidationResult<T>> {
    return new Promise((res, rej) => {
      if (typeof validation === 'function') {
        res(validation(content))
      } else {
        joi.validate(content, validation, (error, value) => {
          res({ error, value })
        })
      }
    })
  }

  public onMessage<TContent>(
    route: string,
    handler: MethodHandler<TContent>,
    validation?: JsonMessageValidation<TContent>,
  ) {
    this.messenger.onMessage<TContent>(route, async (content, message) => {
      if (validation) {
        const result = await this.validateMessage(content, validation)
        if (result.error) {
          return this.logger.error('message validation failed:', result.error)
        } else {
          handler(result.value, message)
        }
      } else {
        handler(content, message)
      }
    })
  }
}
