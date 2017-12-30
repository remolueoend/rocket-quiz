import chalk, { Chalk } from 'chalk'
const rand = require('random-int')
import { omit, pick, mergeDeepRight } from 'ramda'
import { inspect } from 'util'
import { Message, Options } from 'amqplib'

const uniqueColorProvider = (
  colors: (keyof Chalk)[] = ['green', 'yellow', 'blue', 'magenta', 'cyan'],
) => {
  let availableColors = colors.slice()
  const colorMapping: { [key: string]: keyof Chalk } = {}

  const get = (key: string) => {
    if (!colorMapping[key]) {
      if (!availableColors.length) {
        availableColors = colors.slice()
      }
      colorMapping[key] = availableColors.splice(
        rand(availableColors.length - 1),
        1,
      )[0]
    }
    return colorMapping[key]
  }

  const randChalk = (key: string, ...args: any[]) =>
    (chalk as any)[get(key)](...args)

  const colorChalk = (color: keyof Chalk, ...args: any[]) =>
    (chalk as any)[color](...args)

  return {
    get,
    randChalk,
    chalk: colorChalk,
  }
}

const clrProv = uniqueColorProvider()

const getLevelColor = (level: string) => {
  switch (level) {
    case 'debug':
      return 'magenta'
    case 'info':
      return 'blue'
    case 'warn':
      return 'yellow'
    case 'error':
      return 'red'
    default:
      return 'white'
  }
}

type BusEventData = {
  data?:
    | string
    | {
        message: string
        code: string
        context: {}
        stack: string
      }
  event: string
  process: {
    name: string
  }
}

type WinstonLog = {
  message: string
  label?: string
  level: string
  meta?: {}
}

const parseLogMessage = (
  jsonBusData: BusEventData,
  event?: string,
): WinstonLog[] => {
  try {
    if (typeof jsonBusData.data === 'object') {
      return [
        {
          message: jsonBusData.data.message,
          level: 'error',
          meta: pick(['code', 'stack', 'context'], jsonBusData.data),
        },
      ]
    } else {
      return (jsonBusData.data || '{}')
        .split('\n')
        .filter(e => e.length)
        .map(e => JSON.parse(e))
    }
  } catch (err) {
    return [
      {
        message: `Failed to parse log message:\n${jsonBusData.data}`,
        level: 'error',
      },
    ]
  }
}

const printLogEntry = (
  entry: WinstonLog,
  jsonBusData: BusEventData,
  event?: string,
) => {
  const srvName = jsonBusData.process.name || entry.label
  const print = [
    event ? `[${chalk.dim(event)}]` : undefined,
    srvName ? `[${clrProv.randChalk(srvName, srvName)}]` : undefined,
    entry.level
      ? clrProv.chalk(getLevelColor(entry.level), entry.level.toUpperCase())
      : undefined,
    entry.message || jsonBusData.event,
  ]

  const meta = omit(['message', 'level', 'label'], entry)
  const logCallArgs = [
    print.filter(p => !!p).join(' '),
    ...(Object.keys(meta).length
      ? [
          inspect(meta, {
            depth: 3,
            colors: true,
          }),
        ]
      : []),
  ]
  console.log.apply(console, logCallArgs)
}

export const printLog = (jsonBusData: BusEventData, event?: string) => {
  const parsedLogEntries = parseLogMessage(jsonBusData, event)
  parsedLogEntries.forEach(e => printLogEntry(e, jsonBusData, event))
}

/**
 * Returns an object conatining message meta data to print in a log message.
 * @param message the message to print
 */
export const printMsgMeta = (message: {
  properties: Options.Publish
  fields?: { routingKey?: string }
}) =>
  mergeDeepRight(
    pick(
      [
        'contentType:',
        'messageId',
        'timestamp',
        'type',
        'appId',
        'replyTo',
        'correlationId',
        'headers',
      ],
      message.properties,
    ),
    pick(['routingKey'], message.fields || {}),
  )
