import { createMessenger, Messenger } from '../../lib/messenger'
import { createGenericMessage } from '../../lib/message-helpers'
import { BaseService } from '../BaseService'
import config from '../../lib/config'

const INCOMING_CMD_ROUTE = 'chat.incoming.command'

export class CmdInterpreter extends BaseService {
  constructor(public readonly messenger: Messenger) {
    super(messenger)

    this.onMessage(INCOMING_CMD_ROUTE, content =>
      this.handleCommand(content as string),
    )
  }

  public handleCommand(content: string) {
    if (content === 'hello') {
      this.messenger.sendToExchange('chat.outgoing.message', createGenericMessage({}))
    }
    else {
      this.messenger.sendToExchange('chat.outgoing.message', createGenericMessage(''))
    }
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
