import { createMessenger, Messenger } from '../../lib/messenger'
import { createGenericMessage } from '../../lib/message-helpers'
import { BaseService } from '../BaseService'
import config from '../../lib/config'

const INCOMING_CMD_ROUTE = 'chat.incoming.command'

interface CommandUser {
  _id: string
  name: string
  username: string
}

interface IncomingCommandMessage {
  cmd: {
    name: string
    args: string[]
  }
  meta: {
    chatMessageId: string
    roomId: string
    interactionId: string
    updatedAt: number
    user: CommandUser
  }
}

type CommandHandlerResponse = {
  type: 'text' | 'mention'
  value: string | CommandUser
}[]

type CommandHandler = (
  message: IncomingCommandMessage,
) => CommandHandlerResponse

const commandHandlers: { [name: string]: CommandHandler } = {
  hello: message => [
    { type: 'mention', value: message.meta.user },
    { type: 'text', value: 'Hey back!' },
  ],
}

export class CmdInterpreter extends BaseService {
  constructor(public readonly messenger: Messenger) {
    super('cmd-interpreter', messenger)

    this.onMessage<IncomingCommandMessage>(INCOMING_CMD_ROUTE, content =>
      this.handleCommand(content),
    )
  }

  public handleCommand(message: IncomingCommandMessage) {
    const cmdHandler = commandHandlers[message.cmd.name]
    const handlerResp = !!cmdHandler
      ? cmdHandler(message)
      : [
          { type: 'mention', value: message.meta.user },
          { type: 'text', value: 'Could not understand that...' },
        ]

    this.messenger.sendToExchange(
      'chat.outgoing.message',
      createGenericMessage({
        content: handlerResp,
        roomId: message.meta.roomId,
      }),
    )
  }
}

export const createCmdInterpreter = async () => {
  const messenger = await createMessenger(
    'cmd-interpreter',
    [INCOMING_CMD_ROUTE],
    config.broker,
  )

  return new CmdInterpreter(messenger)
}

createCmdInterpreter().then(process => process.listen())
