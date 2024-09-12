import "reflect-metadata";
import { inject, injectable } from "inversify";
import { TYPES } from "../types";
import amqp, { ConfirmChannel } from "amqplib";
import IHealth from "../interfaces/health.interface";
import IState from "../interfaces/state.interface";
import IQueue from "../interfaces/queue.interface";
import ILogger from "../interfaces/logger.interface";
import container, { logger } from "./../container";
import _ from "lodash";

@injectable()
export default class Queue implements IQueue {
  initialized = false;

  private connection!: amqp.Connection;

  channel!: ConfirmChannel;
  listOfChannel!: Record<string, ConfirmChannel>;
  private _state: IState;
  private _health: IHealth;
  private _logger: ILogger;
  private _consumerTags: Record<string, ((message: unknown) => void)[]> = {};
  private _forceClose = false;
  private _reconnecting = false;
  private _reconnectTimeout = 3000;
  private _multipleChannel = false;
  private _prefetch = 100;

  constructor(
    @inject(TYPES.State) state: IState,
    // eslint-disable-next-line no-shadow
    @inject(TYPES.Health) health: IHealth,
    // eslint-disable-next-line no-shadow
    @inject(TYPES.Logger) logger: ILogger
  ) {
    this._state = state;
    this._health = health;
    this._logger = logger;
  }

  //#region Private methods
  private async _waitForConnection(): Promise<void> {
    if (!this._reconnecting) return;

    container.logger.info("Waiting for reconnection to resolve", {
      operation: "rabbitMq",
    });

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve(this._waitForConnection());
      }, 500);
    });
  }

  private async _reConsume(): Promise<void> {
    // * Clone and clear current
    const _tags = _.cloneDeep(this._consumerTags);
    this._consumerTags = {};

    const results = [];

    for (const queueName in _tags) {
      if (!Object.prototype.hasOwnProperty.call(_tags, queueName)) continue;

      const callbacks = _tags[queueName];

      // * Clear old channel if use multipleChannel
      if (this._multipleChannel) {
        this.listOfChannel = {};
      }

      // * Loop consume
      for (const callback of callbacks) {
        results.push(this.reconsumeProcess(queueName, callback));
      }
    }

    if (results.length === 0) {
      container.logger.info("No queues to reconsume", {
        operation: "rabbitMq",
      });
      return;
    }

    await Promise.all(results);

    container.logger.info("Finished reconsuming queues if present", {
      operation: "rabbitMq",
    });
  }

  //#endregion

  async init(option: {
    hostname: string;
    port?: number;
    username: string;
    password: string;
    prefetch?: number;
    useMultiChannels?: boolean | false;
  }): Promise<void> {
    try {
      if (this.initialized) {
        this._logger.warn("Queue already initialized!", {
          operation: "rabbitMq",
        });
        return;
      }

      this._logger.info("Connecting to Queue...", { operation: "rabbitMq" });

      const { hostname, port, username, password, prefetch, useMultiChannels } =
        option;

      if (useMultiChannels) {
        this._multipleChannel = useMultiChannels;
        this._logger.info("Connecting with option to use multiple channels", {
          operation: "rabbitMq",
        });
      }

      this.connection = await amqp.connect(
        {
          hostname,
          port: port || 5672,
          username,
          password,
          heartbeat: 60,
        },
        {
          clientProperties: { connection_name: this._state.serviceName },
        }
      );

      this.connection.on("error", (error) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (require("amqplib/lib/connection").isFatalError(error)) {
          // eslint-disable-next-line no-console
          container.logger.error("Queue connection error", {
            operation: "rabbitMq",
            error: JSON.stringify(error),
          });
        }
      });

      this.connection.on("close", () => {
        if (this._forceClose) return;

        try {
          container.logger.info("Connection closed", {
            operation: "rabbitMq",
          });
          this.connection.removeAllListeners();
        } catch (error) {
          container.logger.error(
            "Error removing connection listeners from connections onClose event",
            { operation: "rabbitMq", error: JSON.stringify(error) }
          );
        } finally {
          this._reconnecting = true;
          this.initialized = false;
          this.init(option);
        }
      });

      this.channel = await this.connection.createConfirmChannel();

      this._prefetch = prefetch || 100;
      this.channel.prefetch(this._prefetch);

      this.channel.on("error", (error) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        if (require("amqplib/lib/connection").isFatalError(error)) {
          // eslint-disable-next-line no-console
          container.logger.error("Queue channel error", {
            operation: "rabbitMq",
            error: JSON.stringify(error),
          });
        }
      });

      this.channel.on("close", async () => {
        if (this._forceClose) return;

        try {
          container.logger.info("Queue channel closed", {
            operation: "rabbitMq",
          });
          this._reconnecting = true;
          await this.connection.close();
        } catch (error) {
          container.logger.error(
            "Error closing connection from channels onClose event",
            { operation: "rabbitMq", error: JSON.stringify(error) }
          );
        } finally {
          this.channel.removeAllListeners();
        }
      });

      this._logger.info("Connected to Queue", { operation: "rabbitMq" });

      await this._reConsume();

      this._reconnecting = false;
      this._health.queue = true;
      this.initialized = true;
    } catch (error) {
      container.logger.error(
        `Failed to connect to queue, trying again in ${this._reconnectTimeout}ms`,
        {
          operation: "rabbitMq",
          error: JSON.stringify(error),
        }
      );
      setTimeout(() => {
        this._reconnecting = true;
        this._health.queue = false;
        this.initialized = false;
        this.init(option);
      }, this._reconnectTimeout);
    }
  }

  async assertQueue(
    queueName: string,
    options?: amqp.Options.AssertQueue | undefined
  ): Promise<void> {
    try {
      await this.channel.assertQueue(queueName, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error";
      this._logger.error(errorMessage, { error: JSON.stringify(error) });
    }
  }

  async assertExchange(
    name: string,
    type: string,
    options?: amqp.Options.AssertExchange | undefined
  ): Promise<void> {
    try {
      await this.channel.assertExchange(name, type, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error";
      this._logger.error(errorMessage, { error: JSON.stringify(error) });
    }
  }

  async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string
  ): Promise<void> {
    await this.channel.bindQueue(queue, exchange, routingKey);
  }

  async consume(
    queueName: string,
    messageCallback: (message: unknown) => void,
    options?: { exclusive?: boolean; prefetch?: number } | undefined
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error("Queue not initialized");
    }

    if (!options) {
      options = {};
    }
    // * If _multipleChannel is true create a new Channel for consuming messages
    if (this._multipleChannel) {
      if (!this.listOfChannel) {
        // * Initialize listOfChannel as an empty object if it's undefined
        this.listOfChannel = {};
      }

      // * Check if have channel for consume this queue in listOfChannel
      if (!this.listOfChannel[queueName]) {
        // * Create new channel
        const newChannel: ConfirmChannel =
          await this.connection.createConfirmChannel();

        // * Set channel prefetch count
        newChannel.prefetch(options.prefetch || this._prefetch);
        // * Add listOfChannel with new channel
        this.listOfChannel[queueName] = newChannel;
      }

      // * If listOfChannel already have channel for consume queue then go to consume process
      if (this.listOfChannel[queueName]) {
        return new Promise<void>((resolve, reject) => {
          this._waitForConnection().then(() => {
            try {
              // * Consume queue
              this.listOfChannel[queueName].consume(
                queueName,
                (msg) => messageCallback(msg),
                {
                  exclusive: options?.exclusive || false,
                  consumerTag: queueName,
                }
              );

              // * Add to list of consumer tags if not already there
              this._consumerTags[queueName] =
                this._consumerTags[queueName] || [];

              this._consumerTags[queueName].push(messageCallback);

              this._logger.info(`Started consuming ${queueName}`, {
                operation: "rabbitMq",
              });

              resolve();
            } catch (error) {
              const errorMessage =
                error instanceof Error ? error.message : "Error";
              this._logger.error(errorMessage, {
                error: JSON.stringify(error),
              });
              reject(error);
            }
          });
        });
      }
    }

    if (!this._multipleChannel) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            // * Consume queue
            this.channel.consume(queueName, (msg) => messageCallback(msg), {
              exclusive: options?.exclusive || false,
              consumerTag: queueName,
            });

            // * Add to list of consumer tags if not already there
            this._consumerTags[queueName] = this._consumerTags[queueName] || [];

            this._consumerTags[queueName].push(messageCallback);

            this._logger.info(`Started consuming ${queueName}`, {
              operation: "rabbitMq",
            });

            resolve();
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : "Error";
            this._logger.error(errorMessage, { error: JSON.stringify(error) });
            reject(error);
          }
        });
      });
    }
  }

  async reconsumeProcess(
    queueName: string,
    messageCallback: (message: unknown) => void,
    options?: { exclusive?: boolean } | undefined
  ): Promise<void> {
    if (!this.initialized && !this._reconnecting) {
      throw new Error("Queue not initialized");
    }

    if (this._multipleChannel) {
      return new Promise<void>((resolve, reject) => {
        // * Add to list of consumer tags if not already there
        this._consumerTags[queueName] = this._consumerTags[queueName] || [];
        this._consumerTags[queueName].push(messageCallback);

        // * Check if the channel for consuming this queue exists
        if (!this.listOfChannel[queueName]) {
          // * Create new channel
          this.connection
            .createConfirmChannel()
            .then((newChannel) => {
              // * Set channel prefetch count
              newChannel.prefetch(this._prefetch);

              // * Store the new channel
              this.listOfChannel[queueName] = newChannel;

              // * Consume queue on the new channel
              newChannel
                .consume(queueName, (msg) => messageCallback(msg), {
                  exclusive: options?.exclusive || false,
                  consumerTag: queueName,
                })
                .then(() => {
                  this._logger.info(`Started consuming ${queueName}`, {
                    operation: "rabbitMq",
                  });
                  resolve();
                })
                .catch((error) => {
                  const errorMessage =
                    error instanceof Error ? error.message : "Error";
                  this._logger.error(errorMessage, {
                    error: JSON.stringify(error),
                  });
                  reject(error);
                });
            })
            .catch((error) => {
              const errorMessage =
                error instanceof Error ? error.message : "Error";
              this._logger.error(errorMessage, {
                error: JSON.stringify(error),
              });
              reject(error);
            });
        } else {
          // * If the channel already exists, reuse it
          resolve();
        }
      });
    }

    if (!this._multipleChannel) {
      // Your existing code for single channel consumption
      return new Promise<void>((resolve, reject) => {
        this.channel
          .consume(queueName, (msg) => messageCallback(msg), {
            exclusive: options?.exclusive || false,
            consumerTag: queueName,
          })
          .then(() => {
            this._logger.info(`Started consuming ${queueName}`, {
              operation: "rabbitMq",
            });
            resolve();
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : "Error";
            this._logger.error(errorMessage, { error: JSON.stringify(error) });
            reject(error);
          });
      });
    }
  }

  async cancelConsume(queueName: string): Promise<void> {
    await this.channel.cancel(queueName);
  }

  async ack(
    message: amqp.Message,
    allUpTo?: boolean,
    queueName?: string
  ): Promise<void> {
    if (this._multipleChannel && queueName) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            this.listOfChannel[queueName].ack(message, allUpTo);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    if (!this._multipleChannel) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            this.channel.ack(message, allUpTo);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  }

  async ackAll(queueName?: string): Promise<void> {
    if (this._multipleChannel && queueName) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            if (this._multipleChannel) {
              // * Acknowledge all messages
              this.listOfChannel[queueName].ackAll();
              resolve();
            }

            if (!this._multipleChannel) {
              // * Acknowledge all messages
              this.channel.ackAll();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    if (!this._multipleChannel) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            if (this._multipleChannel) {
              // * Acknowledge all messages
              this.channel.ackAll();
              resolve();
            }

            if (!this._multipleChannel) {
              // * Acknowledge all messages
              this.channel.ackAll();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  }

  async nack(
    message: amqp.Message,
    allUpTo?: boolean,
    requeue?: boolean,
    queueName?: string
  ): Promise<void> {
    if (this._multipleChannel && queueName) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            if (this._multipleChannel) {
              // * Acknowledge all messages
              this.listOfChannel[queueName].nack(message, allUpTo);
              resolve();
            }

            if (this._multipleChannel) {
              this.channel.nack(message, allUpTo);
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }

    if (!this._multipleChannel) {
      return new Promise<void>((resolve, reject) => {
        this._waitForConnection().then(() => {
          try {
            if (this._multipleChannel) {
              // * Acknowledge all messages
              this.channel.nack(message, allUpTo);
              resolve();
            }

            if (this._multipleChannel) {
              this.channel.nack(message, allUpTo);
            }
          } catch (error) {
            reject(error);
          }
        });
      });
    }
  }

  async publishToQueue(
    queueName: string,
    message: string,
    headers: { [key: string]: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this._waitForConnection().then(() => {
        this.channel.sendToQueue(
          queueName,
          Buffer.from(message),
          {
            headers,
          }, // eslint-disable-next-line @typescript-eslint/no-empty-function
          (err) => {
            if (err !== null) {
              reject(err);
            }

            resolve();
          }
        );
      });
    });
  }

  async publishToExchange(
    exchangeName: string,
    routingKey: string,
    message: string,
    headers: { [key: string]: string }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this._waitForConnection().then(() => {
        this.channel.publish(
          exchangeName,
          routingKey,
          Buffer.from(message),
          {
            headers,
          },
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          (err) => {
            if (err !== null) {
              reject(err);
            }

            resolve();
          }
        );
      });
    });
  }

  async getMessage(queueName: string): Promise<amqp.Message | null> {
    return new Promise((resolve, reject) => {
      this._waitForConnection().then(() => {
        this.channel
          .get(queueName, {})
          .then((value) => {
            resolve(value === false ? null : value);
          })
          .catch((error) => {
            reject(error);
          });
      });
    });
  }

  close(): Promise<void> {
    this._forceClose = true;

    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      // * Cancel all consumers
      for (const consumerTag in this._consumerTags) {
        if (
          !Object.prototype.hasOwnProperty.call(this._consumerTags, consumerTag)
        )
          continue;

        try {
          await this.channel.cancel(consumerTag);
        } catch (error) {
          logger.warn(`Unable to cancel consuming ${consumerTag}}`, {
            error: JSON.stringify(error),
          });
        }
      }

      // * Requeue unacknowledged messages on this channel
      await this.channel.recover();

      // * Close channel and connection
      await this.channel.close();
      await this.connection.close();

      resolve();
    });
  }
}
