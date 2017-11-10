import {
  connect,
  Connection,
  Channel,
  Options,
  Message,
  Replies,
} from 'amqplib'
import { mergeDeepRight } from 'ramda'
import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import {
  parseJsonMessage,
  createJsonMessage,
  createErrorMessage,
  AppMessage,
  JsonMessage,
  ErrorMessage,
} from './message-helpers'

export const Events = {
  message: Symbol('events.onmessage'),
  request: Symbol('events.onrequest'),
}

export interface CorrelationCallback<TResp> {
  resolve: (content: TResp, msg: JsonMessage<TResp>) => void
  reject: (error: ErrorMessage) => void
}

export type MethodHandler<TMsgContent extends {}> = (
  msg: JsonMessage<TMsgContent>,
) => any

export interface MethodRegistration<TMsg extends {}> {
  handler: MethodHandler<TMsg>
}

export type CorrelationMap = { [corrId: string]: CorrelationCallback<{}> }
export type MethodRegistrations = { [method: string]: MethodRegistration<{}> }

export interface MessengerOptions {
  exclusive: boolean
}

const defaultOpts: MessengerOptions = {
  exclusive: false,
}

export class Messenger extends EventEmitter {
  protected correlations: CorrelationMap
  protected methodRegistrations: MethodRegistrations

  public readonly options: MessengerOptions

  constructor(
    public readonly moduleName: string,
    public readonly conn: Connection,
    public readonly channel: Channel,
    public readonly queue: string,
    options: MessengerOptions,
  ) {
    super()
    this.correlations = {}
    this.methodRegistrations = {}
    this.listenOnQueue(queue, msg => this.handleMessage(msg))
  }

  /**
   * Send a request to the given queue. This methos sends the given message to the queue
   * and returns a promise which gets resolved as soon as a reponse was received for the
   * sent request.
   *
   * @param queue The name of the queue to send the request to.
   * @param message The request message to send.
   */
  public sendRequest<TResponse>(queue: string, message: AppMessage) {
    const corrId = uuid()
    this.sendToQueue(queue, message, {
      replyTo: this.queue,
      correlationId: corrId,
    })
    return new Promise<TResponse>((resolve, reject) => {
      this.correlations[corrId] = { resolve, reject } as any
    })
  }

  /**
   * Sends a message to the given queue.
   *
   * @param queue the name of the queue to send to.
   * @param message the message to send to the queue.
   * @param options optional message options.
   */
  public sendToQueue(
    queue: string,
    message: AppMessage,
    options?: Options.Publish,
  ) {
    return this.channel.sendToQueue(
      queue,
      message.content,
      mergeDeepRight(options, {
        contentType: message.contentType,
        type: message.type,
      }),
    )
  }

  /**
   * Adds a listener to the queue with the given name and calls the provided handler every time
   * a message was received.
   *
   * @param queue The name of the queue to listen on.
   * @param onMessage The handler to call when a message was received.
   */
  public listenOnQueue(
    queue: string,
    onMessage: (msg: Message | null) => void,
  ) {
    this.channel.consume(queue, onMessage, { noAck: false })
  }

  /**
   * Registers a method handler under the specified method name. The handler gets called
   * every time an RPC message for the given method was received.
   * The result of the handler will be sent back to the requester.
   * 
   * @param method The name of the method to register.
   * @param handler The handler function of the method.
   */
  public register<TMsg>(method: string, handler: MethodHandler<TMsg>) {
    this.methodRegistrations[method] = { handler } as any
  }

  /**
   * Calls a method of another client by sending a request message.
   * 
   * @param queueName The name of the queue to send the request to. Might be the name of the module
   * but does not have to be!
   * @param method The method to call
   */
  public call<TResp>(queueName: string, method: string): Promise<TResp>
  /**
   * Calls a method of another client by sending a request message.
   * 
   * @param queueName The name of the queue to send the request to. Might be the name of the module
   * but does not have to be!
   * @param method The method to call
   * @param params Optional method params to send.
   */
  public call<TResp, TParams>(
    queueName: string,
    method: string,
    params?: TParams,
  ) {
    return this.sendRequest<TResp>(
      queueName,
      createJsonMessage(params || {}, method),
    )
  }

  /**
   * Handles the given message by either calling the appropriate method or
   * response handler of a previous request.
   *
   * @param msg The message to handle.
   */
  protected handleMessage(msg: Message | null) {
    this.emit(Events.message, msg)
    if (!msg) return
    const corrId: string | undefined = msg.properties.correlationId
    if (typeof corrId !== 'undefined') {
      if (this.correlations[corrId]) {
        this.handleResponse(msg, this.correlations[corrId])
        // reply queue and type = method must be set:
      } else if (msg.properties.replyTo && msg.properties.type !== 'app-msg') {
        this.handleRequest(msg, corrId, msg.properties.replyTo)
      } else {
        // todo: warning: message has correlationId but is not response nor request
      }
    }
    this.channel.ack(msg)
  }

  protected handleRequest(msg: Message, corrId: string, replyQueue: string) {
    this.emit(Events.request, msg)
    const methodName = msg.properties.type
    const method = this.methodRegistrations[methodName]
    try {
      if (!method) {
        throw new Error(`method ${methodName} not found on ${this.moduleName}.`)
      }
      const handlerResp = method.handler(parseJsonMessage(msg))
      const handlerRespPromise =
        typeof handlerResp.then === 'function'
          ? handlerResp as PromiseLike<any>
          : Promise.resolve(handlerResp)
      handlerRespPromise.then(respContent => {
        this.sendToQueue(replyQueue, createJsonMessage(respContent), {
          correlationId: corrId,
        })
      })
    } catch (err) {
      this.sendToQueue(replyQueue, createErrorMessage(err), {
        correlationId: corrId,
        type: '__error',
      })
    }
  }

  /**
   * Handles a message which was received as a response of a previous request.
   * Tries to resolve or reject the promise of the original request call.
   *
   * @param msg the reponse message to handle
   * @param corrId The correlation ID of the message.
   */
  protected handleResponse<TResp>(
    msg: Message,
    callback: CorrelationCallback<TResp>,
  ) {
    const appMsg = parseJsonMessage(msg)
    if (appMsg.type === '__error') {
      callback.reject(appMsg as ErrorMessage)
    } else {
      callback.resolve(appMsg.content as TResp, appMsg as JsonMessage<TResp>)
    }
  }
}

/**
 * Returns a promise resolving a newly created messenger.
 *
 * @param moduleName The name of the module which owns the messenger.
 * @param options Optional messenger options.
 */
export const createMessenger = (
  moduleName: string,
  options?: MessengerOptions,
) =>
  connect('amqp://localhost')
    .then(conn =>
      conn.createChannel().then(ch => {
        const opts = mergeDeepRight(defaultOpts, options || {})
        return ch
          .assertQueue(opts.exclusive ? '' : moduleName, {
            exclusive: opts.exclusive,
          })
          .then(
            q =>
              [conn, ch, q, opts] as [
                Connection,
                Channel,
                Replies.AssertQueue,
                MessengerOptions
              ],
          )
      }),
    )
    .then(
      ([conn, channel, q, opts]) =>
        new Messenger(moduleName, conn, channel, q.queue, opts),
    )
