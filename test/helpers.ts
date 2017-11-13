import { createMessenger, MessengerOptions } from '../src/lib/messenger'
import { BrokerConfig, defaultConfig } from '../src/lib/config'
import { mergeDeepRight } from 'ramda'

export const brokerConfig: BrokerConfig = {
  host: defaultConfig.broker.host,
  vhost: 'unit_tests',
  exchangeName: defaultConfig.broker.exchangeName,
}

export const messengerConfig = {
  queuesDurable: false,
  exchangeDurable: false,
}

export const createMessengers = async (
  serviceNames: string[],
  options?: MessengerOptions,
) => {
  const messengers = await Promise.all(
    serviceNames.map(m =>
      createMessenger(
        m,
        brokerConfig,
        mergeDeepRight(messengerConfig, options || {}),
      ),
    ),
  )
  return await Promise.all(messengers.map(m => m.listen()))
}

export const waitFor = <T>(ms: number) =>
  new Promise<T>((resolve, reject) => {
    setTimeout(() => resolve(), ms)
  })
