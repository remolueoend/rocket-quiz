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
  createRequestMessage,
  createResponseMessage,
  AppMessage,
  JsonMessage,
  RpcError,
  MESSAGE_TYPE,
  getMethod,
  hasError,
} from './message-helpers'
import AppError from './AppError'
import { forEach } from 'ramda'
import createLog from './log'

export const Events = {
  message: Symbol('events.onmessage'),
  request: Symbol('events.onrequest'),
}

export interface CorrelationCallback<TResp> {
  resolve: (content: TResp, msg: JsonMessage<TResp>) => void
  reject: (error: RpcError) => void
}

export type MethodHandler<TMsgContent extends {}> = (
  content: TMsgContent,
  msg: JsonMessage<TMsgContent>,
) => any

export interface MethodRegistration<TMsg extends {}> {
  handler: MethodHandler<TMsg>
}

export type CorrelationMap = { [corrId: string]: CorrelationCallback<{}> }
export type MethodRegistrations = { [method: string]: MethodRegistration<{}> }

export interface MessengerOptions {
  queuesDurable: boolean
  exchangeDurable?: boolean
  listen?: string[]
}

const logger = createLog('messenger')

const defaultOpts: MessengerOptions = {
  queuesDurable: false,
  exchangeDurable: true,
  listen: [],
}

export class Messenger extends EventEmitter {
  protected correlations: CorrelationMap
  protected methodRegistrations: MethodRegistrations

  public readonly options: MessengerOptions

  constructor(
    public readonly moduleName: string,
    public readonly conn: Connection,
    public readonly channel: Channel,
    public readonly exchange: string,
    public readonly moduleQueue: string,
    public readonly processQueue: string,
    options: MessengerOptions,
  ) {
    super()
    this.correlations = {}
    this.methodRegistrations = {}
    this.options = mergeDeepRight(defaultOpts, options || {})

    forEach(key => channel.bindQueue(moduleQueue, exchange, key), [
      ...(this.options.listen || []),
      moduleName,
    ])

    this.listenOnQueue(moduleQueue, msg => this.handleMessage(msg))
    this.listenOnQueue(processQueue, msg => this.handleMessage(msg))
  }

  /**
   * Send a request to the given queue. This methos sends the given message to the queue
   * and returns a promise which gets resolved as soon as a reponse was received for the
   * sent request.
   *
   * @param queue The name of the queue to send the request to.
   * @param message The request message to send.
   */
  public sendRequest<TResponse>(key: string, message: AppMessage) {
    const corrId = message.properties.correlationId
    if (!corrId) {
      throw new AppError(
        1,
        'Messenger.sendRequest: Message has no correlation ID',
      )
    }
    logger.debug('sendRequest', key)
    this.sendToExchange(
      key,
      message,
      mergeDeepRight(message.properties || {}, {
        replyTo: this.processQueue,
      }),
    )
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
    options: Options.Publish = {},
  ) {
    return this.channel.sendToQueue(
      queue,
      message.content,
      mergeDeepRight(message.properties || {}, options),
    )
  }

  public sendToExchange(
    key: string,
    message: AppMessage,
    options: Options.Publish = {},
  ) {
    logger.debug('sendToExchange', key, this.exchange)
    return this.channel.publish(
      this.exchange,
      key,
      message.content,
      mergeDeepRight(message.properties || {}, options),
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
  public call<TResp>(key: string, method: string): Promise<TResp>
  public call<TResp, TParams>(
    key: string,
    method: string,
    params: TParams,
  ): Promise<TResp>
  /**
   * Calls a method of another client by sending a request message.
   * 
   * @param queueName The name of the queue to send the request to. Might be the name of the module
   * but does not have to be!
   * @param method The method to call
   * @param params Optional method params to send.
   */
  public call<TResp, TParams>(key: string, method: string, params?: TParams) {
    return this.sendRequest<TResp>(
      key,
      createRequestMessage(params || {}, method),
    )
  }

  /**
   * Handles the given message by either calling the appropriate method or
   * response handler of a previous request.
   *
   * @param msg The message to handle.
   */
  public handleMessage(msg: Message | null) {
    this.emit(Events.message, msg)
    if (!msg) return
    switch (msg.properties.type) {
      case MESSAGE_TYPE.REQUEST:
        this.handleRequest(msg)
        break
      case MESSAGE_TYPE.RESPONSE:
        this.handleResponse(msg)
        break
    }
  }

  public handleRequest(msg: Message) {
    this.channel.ack(msg)
    logger.debug('handleRequest', msg.properties.correlationId)
    const replyQueue = msg.properties.replyTo
    const corrId = msg.properties.correlationId
    if (!replyQueue) {
      // todo: send log message: Invalid requst message
      return
    }
    if (!corrId) {
      // todo: send log message: Invalid requst message
      return
    }
    this.emit(Events.request, msg)
    const methodName = getMethod(msg)
    const method = this.methodRegistrations[methodName]
    try {
      if (!method) {
        throw new Error(`method ${methodName} not found on ${this.moduleName}.`)
      }
      const parsed = parseJsonMessage(msg)
      const handlerResp = method.handler(parsed.content, parsed)
      const handlerRespPromise =
        typeof handlerResp.then === 'function'
          ? handlerResp as PromiseLike<any>
          : Promise.resolve(handlerResp)
      handlerRespPromise.then(respContent => {
        this.sendToQueue(replyQueue, createResponseMessage(respContent, msg))
      })
    } catch (err) {
      this.sendToQueue(replyQueue, createErrorMessage(err, msg))
    }
  }

  /**
   * Handles a message which was received as a response of a previous request.
   * Tries to resolve or reject the promise of the original request call.
   *
   * @param msg the reponse message to handle
   * @param corrId The correlation ID of the message.
   */
  public handleResponse<TResp>(msg: Message) {
    this.channel.ack(msg)
    logger.debug('handleResponse', msg.properties.correlationId)
    const corrId: string | undefined = msg.properties.correlationId
    const callback = corrId && this.correlations[corrId]
    if (!corrId) {
      return
      // todo log invalid response: No correlation ID
    }

    delete this.correlations[corrId]
    if (!callback) {
      return
      // todo log invalid response: No request callback
    }
    const parsed = parseJsonMessage(msg)
    if (hasError(msg)) {
      callback.reject(parsed as RpcError)
    } else {
      callback.resolve(parsed.content as TResp, parsed as JsonMessage<TResp>)
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
  exchangeName: string,
  options?: MessengerOptions,
) =>
  connect('amqp://localhost').then(conn =>
    conn.createChannel().then(ch => {
      const opts = mergeDeepRight(defaultOpts, options || {})
      return Promise.all([
        ch.assertExchange(exchangeName, 'topic', {
          durable: opts.exchangeDurable,
        }),
        ch.assertQueue(opts.queuesDurable ? moduleName : '', {
          exclusive: !opts.queuesDurable,
        }),
        ch.assertQueue('', {
          exclusive: true,
        }),
      ]).then(
        ([exchange, moduleQueue, processQueue]) =>
          new Messenger(
            moduleName,
            conn,
            ch,
            exchange.exchange,
            moduleQueue.queue,
            processQueue.queue,
            opts,
          ),
      )
    }),
  )
