const ecosystem = require('../ecosystem.config')
import { StartOptions, Proc } from 'pm2'
import * as pm2 from 'pm2'
import * as yargs from 'yargs'
import { mergeDeepRight } from 'ramda'
import { toPromise } from './lib/helpers'
import { createLogger } from './lib/log'
import chalk from 'chalk'
const rand = require('random-int')

const colors = ['red', 'green', 'yellow', 'blue', 'magenta', 'cyan']
let colorMappings: { [s: string]: string } = {}
const getSrvColor = (s: string) =>
  colorMappings[s] ||
  (colorMappings = {
    ...colorMappings,
    ...{ [s]: colors[rand(colors.length - 1)] },
  })[s]

const args = yargs
  .option('apps', {
    type: 'array',
    alias: 'a',
    describe:
      'A comma separated list of apps to start. By default all apps defined in the current ecosystem are included.',
  })
  .option('exclude', {
    type: 'array',
    alias: 'e',
    describe: 'A comma separated list of apps to exclude.',
  }).argv
const logger = createLogger('index')

const startup = async () => {
  const appsArg: string[] = args['apps']
  const excludeArg: string[] = args['exclude']

  let appList = ecosystem.apps as StartOptions[]
  if (appsArg && appsArg.length) {
    appList = appList.filter(a => a.name && appsArg.indexOf(a.name) > -1)
  }
  if (excludeArg && excludeArg.length) {
    appList = appList.filter(a => a.name && excludeArg.indexOf(a.name) < 0)
  }

  const startPromises = appList.map(appCfg =>
    toPromise<typeof pm2, Proc>(pm2, 'start')(
      mergeDeepRight(appCfg, {
        // we use the service internal logs:
        out_file: '/dev/null',
        error_file: '/dev/null',
        // out_file: './logs/index.log',
        // err_file: './logs/index.log',
      }),
    ),
  )
  const procs = await Promise.all(startPromises)
  logger.info(`services started`)

  pm2.launchBus((err, bus) => {
    bus.on('*', (e: string, data: any) => {
      const serviceName = data.process.name
      if (e !== 'log:PM2' || serviceName !== 'PM2') {
        console.log(
          `[${chalk.dim(e)}][${(chalk as any)[getSrvColor(serviceName)](
            serviceName,
          )}] ${data.data || data.event}`,
        )
      }
    })
  })
}

pm2.connect(true, err => {
  if (err) {
    throw err
  }
  startup()
})
