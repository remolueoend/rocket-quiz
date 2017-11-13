# RocketQuiz

## Topics
Following topics are used by the app services to communicate with each other:
 * `log.write`: Indicates a log message to persist. The encoded message is of type `LogMessage`.
 * `chat.incoming` Indicates an incoming chat message from a user. Type `IncomingChatMessage`.
 * `chat.outgoing` Indicates a message which should be sent to the chat. Type `OutgoingChatMessage`.