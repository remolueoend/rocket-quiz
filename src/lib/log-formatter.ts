import chalk, { Chalk } from 'chalk'
const rand = require('random-int')
import { omit } from 'ramda'
import { inspect } from 'util'

const uniqueColorProvider = (
  colors: (keyof Chalk)[] = [
    'red',
    'green',
    'yellow',
    'blue',
    'magenta',
    'cyan',
  ],
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
  data?: string
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

export const printLog = (jsonBusData: BusEventData, event?: string) => {
  const logData: WinstonLog = JSON.parse(jsonBusData.data || '{}')
  const srvName = jsonBusData.process.name || logData.label
  const print = [
    event ? `[${chalk.dim(event)}]` : undefined,
    srvName ? `[${clrProv.randChalk(srvName, srvName)}]` : undefined,
    logData.level
      ? clrProv.chalk(getLevelColor(logData.level), logData.level.toUpperCase())
      : undefined,
    logData.message || jsonBusData.event,
  ]

  const meta = omit(['message', 'level', 'label'], logData)
  const logCallArgs = [
    print.filter(p => !!p).join(' '),
    ...(Object.keys(meta).length
      ? [inspect(meta, { depth: 3, colors: true })]
      : []),
  ]
  console.log.apply(console, logCallArgs)
}
