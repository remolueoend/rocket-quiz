import 'mocha'
import { assert, expect } from 'chai'
import chaiAsPromised = require('chai-as-promised')
import sinonChai = require('sinon-chai')
import { spy, stub } from 'sinon'
import { createJsonMessage } from '../../src/lib/message-helpers'
import { createMessenger, Messenger, Events } from '../../src/lib/messenger'
import { createMessengers, waitFor } from '../helpers'

const chai = require('chai')
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('messenger', () => {
  describe('createMessenger', () => {
    it('resolves a new Messenger instance', () => {
      return createMessenger('test').then(m => assert.instanceOf(m, Messenger))
    })
  })
  describe('Messenger', () => {
    describe('sendToQueue', () => {
      it('sends a message to the given queue', done => {
        createMessengers(
          [
            'test.Messenger.sendToQueue.sender',
            'test.Messenger.sendToQueue.receiver',
          ],
          { exclusive: true },
        ).then(([sender, rec]) => {
          // if message is not received the test will fail with a timeout:
          rec.on(Events.message, () => done())
          sender.sendToQueue(rec.queue, createJsonMessage({ data: 'test' }))
        })
      })
    })

    describe('sendRequest', () => {
      it('sends a request message', done => {
        createMessengers(
          [
            'test.Messenger.sendToQueue.sender',
            'test.Messenger.sendToQueue.receiver',
          ],
          { exclusive: true },
        ).then(([sender, rec]) => {
          rec.on(Events.request, () => done())
          sender
            .sendRequest(
              rec.queue,
              createJsonMessage({ data: 'test' }, 'test-method'),
            )
            .catch(() => {
              // will throw because there is no valid action registered for this call.
            })
        })
      })
    })
    describe('handleRequst', () => {
      let sender: Messenger
      let rec: Messenger

      beforeEach(done => {
        createMessengers(
          [
            'test.Messenger.sendToQueue.sender',
            'test.Messenger.sendToQueue.receiver',
          ],
          { exclusive: true },
        ).then(([newSender, newRec]) => {
          rec = newRec
          sender = newSender
          done()
        })
      })

      it('responds to a request with the method result', done => {
        const method = 'test-method'
        const response = 'test-result'
        rec.register(method, () => response)
        sender.call<string>(rec.queue, method).then(res => {
          const err =
            res === response
              ? null
              : new Error(`Invalid response. Expected ${response}, got: ${res}`)
          done(err)
        }, done)
      })
    })
  })
})
