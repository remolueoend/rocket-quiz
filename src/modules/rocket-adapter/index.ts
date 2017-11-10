import config from '../../lib/config'
import * as WebSocket from 'ws'

export const init = () => {
  const ws = new WebSocket(config.adapters.rocketChat.url)
  ws.on('open', () => {
    ws.send({
      msg: 'connect',
      version: '1',
      support: ['1'],
    })
  })
}
