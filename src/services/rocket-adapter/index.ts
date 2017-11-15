import config from '../../lib/config'
import { createLogger } from '../../lib/log'
import { createMessenger } from '../../lib/messenger'
const RocketChatClient = require('rocketchat').RocketChatClient
import AppError from '../../lib/AppError'

export type UserInfo = {
  userId: string
}

type DefaultCallback = (err: Error, body: any) => void

/**
 * Transforms a function acception a (err, data) - callback as last argument into a function
 * returning a promise. 
 * @param obj Object context of the function 
 * @param method The name of the function to call
 */
const toPromise = <TContext>(
  obj: TContext,
  method: keyof TContext,
): ((...args: any[]) => Promise<any>) => {
  return (...args: any[]) => {
    return new Promise((resolve, reject) => {
      const fn: Function = obj[method] as any
      if (typeof fn !== 'function') {
        return reject(
          new AppError(2, `toPromise: ${method} is not a valid function.`),
        )
      }
      try {
        fn.apply(obj, [
          ...args,
          (err: Error, body: any) => {
            if (err) return reject(err)
            return resolve(body)
          },
        ])
      } catch (err) {
        reject(err)
      }
    })
  }
}

export interface RocketChatClientType {
  joinRoom(id: string, callback: DefaultCallback): void
  miscellaneous: {
    info: (cb: DefaultCallback) => void
  }
  channels: {
    invite: (roomId: string, userId: string, cb: DefaultCallback) => void
    list: (filter: {}, cb: DefaultCallback) => void
  }
  chat: {
    postMessage: (
      msg: { roomId: string; text: string },
      cb: DefaultCallback,
    ) => void
  }
  notify: {
    room: {
      onChanged: (roomId: string, cb: DefaultCallback) => void
    }
  }
}

export interface IncomingMessageUser {
  _id: string
  name: string
  username: string
}

export interface IncomingMessageArgs {
  _id: string
  _updatedAt: { $date: number }
  msg: string
  ts: { $date: number }
  u: IncomingMessageUser
}
export interface IncomingRocketMessage {
  fields: {
    eventName: string
    args: IncomingMessageArgs[]
  }
}

export interface IncomingMessage {
  user: IncomingMessageUser
  msg: string
  updatedAt: number
}

export const parseIncomingMessage = (
  msg: IncomingRocketMessage,
): IncomingMessage => {
  const args = msg.fields.args[0]
  return {
    user: args.u,
    msg: args.msg,
    updatedAt: args._updatedAt.$date,
  }
}

export const getServerInfo = async (client: RocketChatClientType) => {
  return toPromise(client.miscellaneous, 'info')
}

export const joinRoom = async (
  client: RocketChatClientType,
  userInfo: UserInfo,
) => {
  const joined = await toPromise(client.channels, 'invite')(
    config.services.chat.roomName,
    userInfo.userId,
  )
  return joined
}

export const getRoomList = async (client: RocketChatClientType) =>
  toPromise(client.channels, 'list')({})

export const connect = async (): Promise<[RocketChatClientType, UserInfo]> => {
  const { protocol, host, port, username, password } = config.services.chat
  return new Promise<[RocketChatClientType, UserInfo]>((resolve, reject) => {
    const client = new RocketChatClient(
      protocol,
      host,
      port,
      username,
      password,
      (error: any, userInfo: { userId: string }) => {
        if (error) {
          reject(error)
        } else {
          resolve([client, userInfo])
        }
      },
    )
  })
}

export const postMessage = async (
  client: RocketChatClientType,
  roomId: string,
  message: string,
) => toPromise(client.chat, 'postMessage')({ roomId, text: message })

export const handleIncomingMessage = (
  client: RocketChatClientType,
  roomId: string,
  msg: IncomingMessage,
) => {
  if (msg.msg.startsWith('@quiz-bot')) {
    postMessage(client, roomId, 'you wrote a command!: ' + msg.msg)
  }
}

export const start = async () => {
  const [client, userInfo] = await connect()
  const rooms = await getRoomList(client)
  const quizRoom = rooms.channels.find(
    (c: any) => c.name === config.services.chat.roomName,
  )
  if (!quizRoom) {
    throw new AppError(
      4,
      `Could not find room with name: ${config.services.chat.roomName}`,
    )
  }
  const roomId = quizRoom._id
  postMessage(client, roomId, `I'm online!`)
  client.notify.room.onChanged(roomId, (err, body) => {
    if (err) {
      console.error(err)
    } else {
      console.log(body)
      const msg = parseIncomingMessage(body)

      // do not handle own messages:
      if (msg.user._id !== userInfo.userId) {
        handleIncomingMessage(client, roomId, msg)
      }
    }
  })
}

start()
