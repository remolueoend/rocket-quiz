#!/usr/bin/env node

const { mergeDeepRight } = require('ramda')
const { spawn, execSync } = require('child_process')
const yargs = require('yargs')
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
  })
  .option('watch', {
    type: 'boolean',
    alias: 'w',
    describe: 'If provided, pm2 will be started in watch mode.',
  }).argv

const call = (cmd, args) =>
  execSync([cmd, ...args].join(' '), {
    stdio: [0, 1, 2],
  })

const callAsync = (cmd, args, env) => {
  return spawn(cmd, args, {
    stdio: [0, 1, 2],
    env: mergeDeepRight(process.env, env || {}),
  })
}

const isWatching = !!args['watch']

const webpackPath = './node_modules/.bin/webpack'
const webpackArgs = ['--config', 'config/webpack.config.js']

// initial blocking webpack call to compile all files before starting the services:
const initialWebpackProc = call(webpackPath, webpackArgs)

const childProcs = []
if (isWatching) {
  childProcs.push(callAsync(webpackPath, [...webpackArgs, '--watch']))
}
childProcs.push(
  callAsync('node', ['./build/index.js', ...process.argv.slice(2)], {
    PM2_LOG_DATE_FORMAT: '',
  }),
)

const handleSig = sig => {
  let waitCount = childProcs.length
  childProcs.forEach(p => {
    p.on('exit', code => {
      if (--waitCount <= 0) {
        process.exit(code)
      }
    })
    p.kill(sig)
  })
}

process.on('SIGINT', () => handleSig('SIGINT'))
process.on('SIGTERM', () => handleSig('SIGTERM'))
