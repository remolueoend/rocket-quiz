// Will crash the whole process if an unhandled promise rejection is raised.
process.on('unhandledRejection', error => {
  throw error
})

import config from '../../lib/config'
import { createLogger, Logger } from '../../lib/log'
import { createMessenger, Messenger } from '../../lib/messenger'
import { createGenericMessage } from '../../lib/message-helpers'
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

export interface RocketChatUser {
  _id: string
  name: string
  username: string
}

export interface IncomingMessageArgs {
  _id: string
  _updatedAt: { $date: number }
  msg: string
  ts: { $date: number }
  u: RocketChatUser
}
export interface IncomingRocketMessage {
  fields: {
    eventName: string
    args: IncomingMessageArgs[]
  }
}

export interface IncomingMessage {
  user: RocketChatUser
  content: string
  updatedAt: number
}

export interface OutgoingMessage {
  content: Array<{
    type: 'text' | 'mention'
    value: string | RocketChatUser
  }>
}

/**
 * Class providing an interface to a rocket chat client with an authenticated user.
 */
export class RocketAdapter {
  protected logger: Logger

  constructor(
    public readonly client: RocketChatClientType,
    public readonly botInfo: UserInfo,
    public readonly roomId: string,
    public readonly messenger: Messenger,
  ) {
    this.logger = createLogger('rocketchat')
  }

  /**
   * Starts a listener for incoming chat messages.
   */
  public listen() {
    this.messenger.listen()
    this.client.notify.room.onChanged(this.roomId, (err, body) => {
      if (err) {
        this.logger.error('notify.room.onChanged failed', this.roomId, err)
      } else {
        this.handleIncomingMessage(body)
      }
    })
    this.logger.debug('started listener.')
  }

  /**
   * Parsed the fields and content of a message retrieved from a rocket chat client.
   * @param msg The message to parse.
   */
  public parseIncomingMessage(msg: IncomingRocketMessage): IncomingMessage {
    const args = msg.fields.args[0]
    return {
      user: args.u,
      content: args.msg,
      updatedAt: args._updatedAt.$date,
    }
  }

  public parseCommand(
    msg: IncomingMessage,
  ): { name: string; sender: RocketChatUser; args: string[] } | null {
    if (msg.content.startsWith(`@${this.botInfo.userId}`)) {
      // we ignore the leading @bot:
      const partials = msg.content.split(' ').slice(1)
      return {
        name: partials[0],
        args: partials.splice(1),
        sender: msg.user,
      }
    } else {
      return null
    }
  }

  /**
   * Handles an incoming message from the rocket chat client.
   * @param msg The incoming message to handle.
   */
  public handleIncomingMessage(msg: IncomingRocketMessage) {
    const parsed = this.parseIncomingMessage(msg)
    const cmd = this.parseCommand(parsed)
    if (cmd) {
      this.logger.debug('propagating command', cmd.name, cmd.args)
      this.messenger.sendToExchange(
        'chat.incoming.command',
        createGenericMessage(cmd),
      )
    } else {
      this.logger.debug('propagating message')
      this.messenger.sendToExchange(
        'chat.incoming.message',
        createGenericMessage(parsed),
      )
    }
  }

  /**
   * Sends a message to 
   * @param msg The message to send.
   */
  public postMessage(msg: OutgoingMessage) {
    const msgText = msg.content
      .map(
        p =>
          p.type === 'text'
            ? p.value as string
            : `@${(p.value as RocketChatUser).username}`,
      )
      .join(' ')
    return toPromise(this.client.chat, 'postMessage')({
      roomId: this.roomId,
      text: msgText,
    })
  }
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

const createAdapter = async () => {
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

  const messenger = await createMessenger(
    'rocketchat',
    ['chat.#'],
    config.broker,
  )
  return new RocketAdapter(client, userInfo, quizRoom.name, messenger)
}

createAdapter().then(adapter => {
  adapter.listen()
})
