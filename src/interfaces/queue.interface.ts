import amqp from "amqplib";

interface IQueue {
  initialized: boolean;

  /**
   * Initializes the RabbitMQ connection with the provided options.
   * @param {Object} options - Connection options.
   * @param {string} options.hostname - The RabbitMQ server hostname.
   * @param {number} [options.port=5672] - The port number for the RabbitMQ server.
   * @param {string} options.username - The username for authenticating with RabbitMQ.
   * @param {string} options.password - The password for authenticating with RabbitMQ.
   * @param {number} [options.prefetch] - The prefetch value for the channel.
   * @param {boolean} [options.useMultiChannels=false] - Flag indicating whether to use multiple channels.
   * @returns {Promise<void>} A Promise that resolves once the connection is initialized.
   */
  init(option: {
    hostname: string;
    port?: number;
    username: string;
    password: string;
    prefetch?: number;
    useMultiChannels?: boolean | false;
  }): Promise<void>;

  /**
   * Assert an exchange into existence,  if the exchange exists already and has properties different to those supplied the channel will be closed.
   * @param name Exchange's name
   * @param type Type of the exchange
   * @param options Exchange's options
   * @description https://amqp-node.github.io/amqplib/channel_api.html#channel_assertExchange
   */
  assertExchange(
    name: string,
    type: string,
    options?: amqp.Options.AssertExchange
  ): Promise<void>;

  /**
   * Assert a queue into existence, if the queue exists already and has properties different to those supplied the channel will be closed.
   * @param name Queue's name
   * @param options Queue's options
   * @description https://amqp-node.github.io/amqplib/channel_api.html#channel_assertQueue
   */
  assertQueue(name: string, options?: amqp.Options.AssertQueue): Promise<void>;

  /**
   * Assert a routing path from an `exchange` to a `queue` which will relay messages to the `queue` with the `routingKey` specified.
   * @param queue Queue's name to bind with
   * @param exchange
   * @param routingKey
   */
  bindQueue(queue: string, exchange: string, routingKey: string): Promise<void>;

  /**
   * Consumes messages from a specified queue and invokes the provided callback.
   * @param {string} queueName - The name of the queue to consume messages from.
   * @param {(message: unknown) => void} messageCallback - Callback function to handle consumed messages.
   * @param {Object} [options] - Additional options for consuming messages.
   * @param {boolean} [options.exclusive=false] - Whether the consumer should be exclusive.
   * @param {number} [options.prefetch] - The number of messages to prefetch. A value of 0 means no prefetching.
   * @returns {Promise<void>} A Promise that resolves once consumption is started.
   * @throws {Error} Throws an error if the queue is not initialized.
   */
  consume(
    queueName: string,
    messageCallback: (message: unknown) => void,
    options?: {
      exclusive?: boolean;
      prefetch?: number;
    }
  ): Promise<void>;

  cancelConsume(queueName: string): Promise<void>;

  /**
   * Acknowledge the given message, or all messages up to and including the given message.
   * @param message The message to acknowledge.
   * @param allUpTo if true, all outstanding messages prior to and including the given message shall be considered acknowledged
   * @param queueName is Optional string use when have multiple channel for action correct channel
   * @description https://amqp-node.github.io/amqplib/channel_api.html#channel_ack
   */
  ack(
    message: amqp.Message,
    allUpTo?: boolean,
    queueName?: string
  ): Promise<void>;

  /**
   * Acknowledge all messages
   * @returns {Promise<void>} A promise that resolves when the acknowledgment is successful.
   * @param queueName is Optional string use when have multiple channel for action correct channel
   */
  ackAll(queueName?: string): Promise<void>;

  /**
   * Reject a message. This instructs the server to either requeue the message or throw it away (which may result in it being dead-lettered).
   * @param message The message to reject.
   * @param allUpTo if true, all outstanding messages prior to and including the given message shall be considered acknowledged
   * @param requeue if true, the server will attempt to requeue the message, otherwise
   * @param queueName is Optional string use when have multiple channel for action correct channel
   * @description https://amqp-node.github.io/amqplib/channel_api.html#channel_nack
   */
  nack(
    message: amqp.Message,
    allUpTo?: boolean,
    requeue?: boolean,
    queueName?: string
  ): Promise<void>;

  /**
   * Publish a message to a given queue.
   * @param queueName Queue to publish to
   * @param message A string or buffer containing the message content. This will be copied during encoding, so it is safe to mutate it once this method has returned.
   * @param headers Headers to publish with message
   * @description https://amqp-node.github.io/amqplib/channel_api.html#confirmchannel_publish
   */
  publishToQueue(
    queueName: string,
    message: string | Buffer,
    headers: { [key: string]: string }
  ): Promise<void>;

  /**
   * Publish a message to a given exchange.
   * @param exchangeName Exchnage to publish to
   * @param routingKey Routing key to
   * @param message A string or buffer containing the message content. This will be copied during encoding, so it is safe to mutate it once this method has returned.
   * @param headers Headers to publish with message
   * @description https://amqp-node.github.io/amqplib/channel_api.html#confirmchannel_sendToQueue
   */
  publishToExchange(
    exchangeName: string,
    routingKey: string,
    message: string | Buffer,
    headers: { [key: string]: string }
  ): Promise<void>;

  getMessage(queueName: string): Promise<amqp.Message | null>;

  close(): Promise<void>;
}

export default IQueue;
