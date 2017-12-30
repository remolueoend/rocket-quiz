import { BaseService } from '../BaseService'
import { Messenger, createMessenger } from '../../lib/messenger'
import config from '../../lib/config'

export class QuestionApiService extends BaseService {
  constructor(messenger: Messenger) {
    super('quations-api', messenger)

    this.messenger.register('getQuestion', content => {
      this.logger.info('Request for method "getQuestion" received.')
      debugger
      return 'What is a rabbit MQ?'
    })
  }
}

export const createQuestionApiService = async () => {
  const messenger = await createMessenger(
    'questions-api',
    ['questions-api', 'questions-api.#'],
    config.broker,
  )
  return new QuestionApiService(messenger)
}

createQuestionApiService().then(service => service.listen())
