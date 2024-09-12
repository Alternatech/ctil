import { Redis, Cluster } from "ioredis";

interface IRedis {
  client: Redis | Cluster;

  init(
    host: string,
    port: number,
    instanceType: "single" | "cluster",
    prefix: string
  ): Promise<void>;

  get(key: string, withPrefix?: boolean): Promise<unknown>;

  /**
   * Set `key` to hold the string `value`
   * @param withPrefix Set if should add an prefix to `key`, default is `true`
   * @param ttl Set the specified expire time, in seconds, default is 3600
   */
  set(
    key: string,
    value: string,
    withPrefix?: boolean,
    ttl?: number
  ): Promise<boolean>;

  delete(key: string, withPrefix?: boolean): Promise<unknown>;

  /**
   * @param ttl Set the specified expire time, in seconds, default is 3600
   */
  multiSet(
    keys: { [keyName: string]: string },
    hash?: string,
    ttl?: number
  ): Promise<boolean>;

  /**
   * @param ttl Set the specified expire time, in seconds, default is 3600
   */
  setHash(
    key: string,
    keyMap: string,
    value: string,
    withPrefix?: boolean,
    ttl?: number
  ): Promise<boolean>;

  getHash(key: string, withPrefix?: boolean): Promise<unknown>;

  deleteHash(
    key: string,
    keyMap: string,
    withPrefix?: boolean
  ): Promise<unknown>;

  close(): Promise<void>;
}

export default IRedis;
