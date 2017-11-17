// Will crash the whole process if an unhandled promise rejection is raised.
process.on('unhandledRejection', error => {
  throw error
})

import { createMessenger, Messenger } from '../../lib/messenger'
import {
  createGenericMessage,
  parseJsonMessage,
} from '../../lib/message-helpers'
import * as readline from 'readline'
import config from '../../lib/config'

export class Repl {
  constructor(
    protected readonly messenger: Messenger,
    protected readonly reader: readline.ReadLine,
  ) {}

  public listen() {
    this.messenger.listen()
    this.startReader()
    this.messenger.on('message', msg => {
      const parsed = parseJsonMessage(msg)
      console.log(parsed.type, parsed.content)
    })
  }

  protected startReader() {
    this.reader.on('line', line => {
      const partials = line.split(' ')
      const action = partials[0]
      try {
        switch (action) {
          case 'call':
            return this.handleCall(partials.slice(1))
          case 'send':
            return this.handleSend(partials.slice(1))
          default:
            console.log('invalid action ' + action)
        }
      } catch (err) {
        console.error(err)
      }
    })
  }

  protected handleCall(partials: string[]) {
    const route = partials[0]
    const method = partials[1]
    const content = partials.slice(2).join(' ')
    this.messenger
      .call(route, method, JSON.parse(content))
      .then(res => {
        console.error(res)
      })
      .catch(errRes => {
        console.error(errRes.content)
      })
  }

  protected handleSend(partials: string[]) {
    const route = partials[0]
    const content = partials.slice(1).join(' ')
    this.messenger.sendToExchange(
      route,
      createGenericMessage(JSON.parse(content)),
    )
  }
}

export const createRepl = async () => {
  const messenger = await createMessenger('repl', ['#'], config.broker)
  return new Repl(
    messenger,
    readline.createInterface({
      input: process.stdin,
    }),
  )
}

createRepl().then(repl => repl.listen())
