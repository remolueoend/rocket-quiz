import { Message } from 'amqplib'
import AppError from './AppError'

export type ContentType = 'application/json' | 'application/octet-stream'

export interface AppMessage {
  type: string
  content: Buffer
  contentType: ContentType
}

export interface JsonMessage<TContent extends {}> {
  type: string
  content: TContent
}

export type ErrorMessage = JsonMessage<{
  message: string
  stack: string
  context?: any
}>

export const createMessage = (
  msgContent: any,
  type = 'app-msg',
  contentType: ContentType = 'application/json',
): AppMessage => {
  const content =
    contentType === 'application/json'
      ? new Buffer(JSON.stringify(msgContent))
      : new Buffer(msgContent)

  return {
    content,
    type,
    contentType,
  }
}

export const createJsonMessage = (content: {}, type = 'app-msg') =>
  createMessage(content, type)

export const createErrorMessage = (error: AppError) => {
  return createJsonMessage(
    {
      message: error.message,
      stack: error.stack,
      context: error.context,
    },
    '__error',
  )
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
  }
}
