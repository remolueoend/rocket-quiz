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
  messenger: Messenger,
) => Promise<CommandHandlerResponse>

const commandHandlers: { [name: string]: CommandHandler } = {
  hello: async message => [
    { type: 'mention', value: message.meta.user },
    { type: 'text', value: 'Hey back!' },
  ],
  ask: async (message, messenger) => {
    debugger
    const questionText = await messenger.call<string>(
      'questions-api',
      'getQuestion',
    )
    return [{ type: 'text', value: questionText }]
  },
}

export class CmdInterpreter extends BaseService {
  constructor(public readonly messenger: Messenger) {
    super('cmd-interpreter', messenger)

    this.onMessage<IncomingCommandMessage>(INCOMING_CMD_ROUTE, content =>
      this.handleCommand(content),
    )
  }

  public async handleCommand(message: IncomingCommandMessage) {
    const cmdHandler = commandHandlers[message.cmd.name]
    let handlerResp: CommandHandlerResponse
    if (!cmdHandler) {
      handlerResp = [
        { type: 'mention', value: message.meta.user },
        { type: 'text', value: 'Could not understand that...' },
      ]
    } else {
      try {
        handlerResp = await cmdHandler(message, this.messenger)
      } catch (err) {
        this.logger.error(
          'Failed to get question from "questions-api::getQuestion"',
          {
            err,
          },
        )
        handlerResp = [
          {
            type: 'text',
            value: 'Sorry, I was not able to get a question. Try again plz..',
          },
        ]
      }
    }

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
