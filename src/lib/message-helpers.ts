import { Message, Options } from 'amqplib'
import AppError from './AppError'
import { v4 as uuid } from 'uuid'
import { mergeDeepRight } from 'ramda'

export enum MESSAGE_TYPE {
  REQUEST = 'request',
  RESPONSE = 'response',
  ERROR = 'error',
  GENERIC = 'app-msg',
}

export type ContentType = 'application/json' | 'application/octet-stream'

export interface AppMessage {
  content: Buffer
  properties: Options.Publish
}

export interface JsonMessage<TContent extends {}> {
  type: string
  method: string
  content: TContent
}

export type RpcError = JsonMessage<{
  code: string
  message: string
  stack: string
  context?: any
}>

export const getHeaders = (msg: Message) => msg.properties.headers || {}
export const getMethod = (msg: Message) => getHeaders(msg).method
export const getErrorCode = (msg: Message) => getHeaders(msg).errorCode
export const hasError = (msg: Message) =>
  typeof getErrorCode(msg) !== 'undefined'

export const createMessage = (
  msgContent: any,
  type = MESSAGE_TYPE.GENERIC,
  contentType: ContentType = 'application/json',
  options = {},
): AppMessage => {
  const content =
    contentType === 'application/json'
      ? new Buffer(JSON.stringify(msgContent))
      : new Buffer(msgContent)

  return {
    content,
    properties: mergeDeepRight(options, {
      type,
      contentType,
    }),
  }
}

export const createJsonMessage = (
  content: {},
  type = MESSAGE_TYPE.GENERIC,
  options?: Options.Publish,
) => createMessage(content, type, 'application/json', options)

export const createRequestMessage = (
  params: {},
  method: string,
) => {
  return createJsonMessage(params, MESSAGE_TYPE.REQUEST, {
    headers: {
      method,
    },
    correlationId: uuid(),
  })
}

export const createResponseMessage = (
  resp: {},
  requMsg: Message,
  options: Options.Publish = {},
) =>
  createJsonMessage(
    resp,
    MESSAGE_TYPE.RESPONSE,
    mergeDeepRight(options, {
      correlationId: requMsg.properties.correlationId,
    }),
  )

export const createErrorMessage = (error: AppError, reqMsg?: Message) => {
  const errPayload = {
    message: error.message,
    stack: error.stack,
    context: error.context,
  }
  const options = { headers: { errorCode: error.code || -1 } }
  if (reqMsg) {
    return createResponseMessage(errPayload, reqMsg, options)
  } else {
    return createJsonMessage(errPayload, MESSAGE_TYPE.ERROR, options)
  }
}

export const parseJsonMessage = <TContent>(
  msg: Message,
): JsonMessage<TContent> => {
  const contentType = msg.properties.contentType
  if (contentType !== 'application/json') {
    throw new Error(
      `Could not parse JSON message. Invalid content-type ${contentType}.`,
    )
  }
  return {
    content: JSON.parse(msg.content.toString()),
    type: msg.properties.type,
    method: getMethod(msg),
  }
}
