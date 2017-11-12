import 'mocha'
import { assert, expect } from 'chai'
import chaiAsPromised = require('chai-as-promised')
import sinonChai = require('sinon-chai')
import { spy, stub } from 'sinon'
import {
  createJsonMessage,
  MESSAGE_TYPE,
  createRequestMessage,
  createResponseMessage,
} from '../../src/lib/message-helpers'
import { createMessenger, Messenger, Events } from '../../src/lib/messenger'
import {
  createMessengers,
  waitFor,
  messengerConfig,
  brokerConfig,
} from '../helpers'

const chai = require('chai')
chai.use(chaiAsPromised)
chai.use(sinonChai)

describe('messenger', () => {
  describe('createMessenger', () => {
    it('resolves a new Messenger instance', () => {
      debugger
      return createMessenger('test', brokerConfig, messengerConfig).then(m =>
        assert.instanceOf(m, Messenger),
      )
    })
  })
  describe('Messenger', () => {
    describe('sendToQueue', () => {
      it('sends a message to the given queue', done => {
        createMessengers([
          'test.Messenger.sendToQueue.sender1',
          'test.Messenger.sendToQueue.receiver1',
        ]).then(([sender, rec]) => {
          // if message is not received the test will fail with a timeout:
          rec.on(Events.message, () => done())
          sender.sendToQueue(
            rec.moduleQueue,
            createJsonMessage({ data: 'test' }),
          )
        })
      })
    })

    describe('sendRequest', () => {
      it('sends a request message', done => {
        createMessengers([
          'test.Messenger.sendToQueue.sender2',
          'test.Messenger.sendToQueue.receiver2',
        ]).then(([sender, rec]) => {
          rec.on(Events.request, () => done())
          sender
            .sendRequest(
              rec.moduleName,
              createRequestMessage(
                {
                  data: 'test',
                },
                'test-method',
              ),
            )
            .catch(() => {
              // will throw because there is no valid action registered for this call.
            })
        })
      })
    })

    describe('handleMessage', () => {
      const createMessenger = async (name: string) => {
        const messengers = await createMessengers([name])
        return messengers[0]
      }

      it('handles request messages correcly', async () => {
        const messenger = await createMessenger('test-messenger1')
        const handleRequestStub = stub(messenger, 'handleRequest').returns({})
        const msg = {
          content: new Buffer([]),
          fields: {},
          properties: { type: MESSAGE_TYPE.REQUEST },
        }
        messenger.handleMessage(msg)
        assert(handleRequestStub.calledWith(msg))
      })

      it('handles response messages correcly', async () => {
        const messenger = await createMessenger('test-messenger2')
        const handleResponseStub = stub(messenger, 'handleResponse').returns({})
        const msg = {
          content: new Buffer([]),
          fields: {},
          properties: { type: MESSAGE_TYPE.RESPONSE },
        }
        messenger.handleMessage(msg)
        assert(handleResponseStub.calledWith(msg))
      })
    })

    describe('handleRequest', () => {
      let sender: Messenger
      let rec: Messenger
      let testCounter = 0

      beforeEach(function(done) {
        createMessengers([
          'test.Messenger.sendToQueue.sender3' + testCounter,
          'test.Messenger.sendToQueue.receiver3' + testCounter,
        ]).then(([newSender, newRec]) => {
          rec = newRec
          sender = newSender
          testCounter++
          done()
        })
      })

      it('rejects if the provided method does not exist', () => {
        return expect(sender.call(rec.moduleName, 'not-existing-method'))
          .rejected
      })

      it('responds to a request with the method result', done => {
        const method = 'test-method'
        const response = 'test-result'
        rec.register(method, () => response)
        sender.call<string>(rec.moduleName, method).then(res => {
          const err =
            res === response
              ? null
              : new Error(`Invalid response. Expected ${response}, got: ${res}`)
          done(err)
        }, done)
      })

      it('calls the method handler with the provided params', done => {
        const method = 'test-method'
        rec.register<{ a: string }>(method, ({ a }) => {
          done(a === 'foo' ? null : new Error('Invalid param.'))
        })
        sender.call(rec.moduleName, method, { a: 'foo' })
      })
    })
  })
})
