/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-inferrable-types */
import "reflect-metadata";
import IORedis, { Cluster } from "ioredis";
import { injectable, inject } from "inversify";
import IState from "../interfaces/state.interface";
import IRedis from "../interfaces/redis.interface";
import IHealth from "../interfaces/health.interface";
import ILogger from "../interfaces/logger.interface";
import { TYPES } from "../types";
import { health, logger } from "./../container";

@injectable()
export default class Redis implements IRedis {
  private _state: IState;
  private _health: IHealth;
  private _logger: ILogger;
  private _prefix = "";
  private initialized = false;
  private initializing = false;
  private host!: string;
  private port!: number;
  private _instanceType!: "single" | "cluster";

  client!: IORedis | Cluster;

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

  async init(
    host: string,
    port: number,
    instanceType: "single" | "cluster",
    prefix: string = ""
  ): Promise<void> {
    // * Skip if primary process
    /* istanbul ignore next */
    if (this.initialized || this.initializing) {
      this._logger.warn("Redis already initialized or is initializing");
      return;
    }

    this._health.redis = false;
    this.initializing = true;

    this._logger.info("Connecting to redis...");

    this.host = host;
    this.port = port;
    this._instanceType = instanceType;

    try {
      this._prefix = `${prefix}_`;
      this.client = await this.createRedisClient();
      this.initialized = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unexpected error";
      this._logger.error(`[redis] ${errorMessage}`, {
        operation: "init",
        error: JSON.stringify(error),
      });
    }
  }

  private async createRedisClient(): Promise<IORedis | Cluster> {
    let client: IORedis | Cluster;

    /* istanbul ignore else */
    if (this._instanceType === "single") {
      client = new IORedis({
        host: this.host,
        port: this.port,
        lazyConnect: true,
        retryStrategy() {
          return 3000;
        },
      });

      client.on("connect", this.onConnect);
      client.on("error", this.onError);
      client.on("reconnecting", this.onReconnecting);

      await client.connect();
      return client;
    }

    if (this._instanceType === "cluster") {
      client = new IORedis.Cluster(
        [
          {
            host: this.host,
            port: this.port,
          },
        ],
        {
          lazyConnect: true,
          clusterRetryStrategy() {
            return 3000;
          },
        }
      );

      client.on("connect", this.onConnect);
      client.on("error", this.onError);
      client.on("reconnecting", this.onReconnecting);

      await client.connect();
      return client;
    }

    throw new Error("Unable to create Redis client");
  }

  private async onConnect() {
    health.redis = true;
    logger.info("Connected to redis");
  }

  /* istanbul ignore next */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async onError(error: any) {
    health.redis = false;
    logger.error("Error connecting to redis", {
      operation: "createRedisClient",
      error: JSON.stringify(error),
    });
  }

  private async onReconnecting() {
    health.redis = false;
    logger.warn("Reconnecting to redis");
  }

  async get(key: string, withPrefix: boolean = true): Promise<unknown> {
    try {
      /* istanbul ignore next */
      return await this.client.get(`${withPrefix ? this._prefix : ""}${key}`);
    } catch (error: any) /* istanbul ignore next */ {
      this._logger.error(`Redis get error`, {
        operation: "redisGet",
        error: JSON.stringify(error),
      });
      return undefined;
    }
  }
  /* istanbul ignore next */
  async set(
    key: string,
    value: string,
    withPrefix: boolean = true,
    ttl: number = 3600
  ): Promise<boolean> {
    if (!this.initialized) {
      this._logger.warn("Redis has not yet initialized");
      return false;
    }

    try {
      const keyToSet = `${withPrefix ? this._prefix : ""}${key}`;
      if (ttl) {
        await this.client.set(keyToSet, value, "EX", ttl);
      } else {
        await this.client.set(keyToSet, value);
      }
      return true;
    } catch (error: any) {
      this._logger.error(`Redis set error`, {
        operation: "redisSet",
        error: JSON.stringify(error),
      });
      return false;
    }
  }
  /* istanbul ignore next */
  async getHash(key: string, withPrefix: boolean = true): Promise<unknown> {
    if (!this.initialized) {
      this._logger.warn("Redis has not yet initialized");
      return false;
    }

    try {
      const keyToSet = `${withPrefix ? this._prefix : ""}${key}`;
      return await this.client.hgetall(keyToSet);
    } catch (error: any) {
      this._logger.error(`Redis get hash error`, {
        operation: "redisGetHash",
        error: JSON.stringify(error),
      });
      return false;
    }
  }
  /* istanbul ignore next */
  async setHash(
    key: string,
    keyMap: string,
    value: string,
    withPrefix: boolean = true,
    ttl: number = 3600
  ): Promise<boolean> {
    if (!this.initialized) {
      this._logger.warn("Redis has not yet initialized");
      return false;
    }
    try {
      const keySet = `${withPrefix ? this._prefix : ""}${key}`;
      await this.client.hset(keySet, keyMap, value);

      if (ttl) await this.client.expire(keySet, ttl);
      return true;
    } catch (error: any) {
      this._logger.error(`Redis set hash error`, {
        operation: "redisSetHash",
        error: JSON.stringify(error),
      });
      return false;
    }
  }
  /* istanbul ignore next */
  async deleteHash(
    key: string,
    keyMap: string,
    withPrefix: boolean = true
  ): Promise<unknown> {
    if (!this.initialized) {
      this._logger.warn("Redis has not yet initialized");
      return false;
    }

    try {
      return await this.client.hdel(
        `${withPrefix ? this._prefix : ""}${key}`,
        keyMap
      );
    } catch (error: any) {
      this._logger.error(`Redis delete hash error`, {
        operation: "redisDeleteHash",
        error: JSON.stringify(error),
      });
      return undefined;
    }
  }

  /* istanbul ignore next */
  async multiSet(
    keys: { [keyName: string]: string },
    hash: string = "",
    ttl: number = 3600
  ): Promise<boolean> {
    if (!this.initialized) {
      this._logger.warn("Redis has not yet initialized");
      return false;
    }

    try {
      await this.client.hmset(hash, keys);

      for (const key in keys) {
        await this.client.expire(key, ttl);
      }

      return true;
    } catch (error: any) {
      this._logger.error(`Redis multi set error`, {
        operation: "redisMultiSet",
        error: JSON.stringify(error),
      });
      return false;
    }
  }
  /* istanbul ignore next */
  async delete(key: string, withPrefix: boolean = true): Promise<unknown> {
    if (!this.initialized) {
      this._logger.warn("Redis has not yet initialized");
      return false;
    }

    try {
      const value = await this.client.del([
        `${withPrefix ? this._prefix : ""}${key}`,
      ]);
      return value > 0;
    } catch (error: any) {
      this._logger.error(`Redis delete error`, {
        operation: "redisDelete",
        error: JSON.stringify(error),
      });
      return undefined;
    }
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.quit((err) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
}
