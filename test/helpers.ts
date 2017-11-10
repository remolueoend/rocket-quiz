import { createMessenger, MessengerOptions } from '../src/lib/messenger'

export const createMessengers = (modules: string[], options?: MessengerOptions) =>
  Promise.all(modules.map(m => createMessenger(m, options)))

export const waitFor = <T>(ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => resolve(), ms)
  })
