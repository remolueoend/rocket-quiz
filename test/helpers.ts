import { createMessenger, MessengerOptions } from '../src/lib/messenger'
import { mergeDeepRight } from 'ramda'
import { v4 as uuid } from 'uuid'

export const createMessengers = (
  modules: string[],
  options?: MessengerOptions,
) => {
  const exchangeUid = uuid()
  return Promise.all(
    modules.map(m =>
      createMessenger(
        m,
        'test-exchange',
        mergeDeepRight(
          { queuesDurable: false, exchangeDurable: false },
          options || {},
        ),
      ),
    ),
  )
}

export const waitFor = <T>(ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => resolve(), ms)
  })
