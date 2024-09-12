import "reflect-metadata";
import axios from "axios";
import qs from "qs";
import { decode, JwtPayload } from "jsonwebtoken";
import { TYPES } from "../types";
import IState, { StateInitOption } from "../interfaces/state.interface";
import ILogger from "../interfaces/logger.interface";
import { queue, redis, health, socket } from "../container";
import { inject, injectable } from "inversify";

@injectable()
export default class State implements IState {
  private _logger!: ILogger;
  private _initialized = false;
  private _accessToken!: string;
  private _authUri!: string;
  private _clientId!: string;
  private _clientSecret!: string;
  private _tokenRetry = 3000;
  private _renewTokenTimeout?: NodeJS.Timeout;
  private _uid?: string;
  private _options?: StateInitOption;
  private _wso2AccessToken!: string;
  private _wso2AuthUrl!: string;
  private _wso2Username!: string;
  private _wso2Password!: string;
  private _wso2GrantType!: string;
  private _wso2Scope?: string;
  private _wso2TokenRetry = 3000;
  private _wso2RenewTokenTimeout?: NodeJS.Timeout;

  serviceName = "";
  serviceVersion = "0.0.0";
  configs: Record<string, unknown> = {};

  constructor(@inject(TYPES.Logger) logger: ILogger) {
    this._logger = logger;
  }

  private async requestToken() {
    this._logger.info("Requesting new access token", {
      operation: "requestToken",
    });
    if (this._renewTokenTimeout) clearTimeout(this._renewTokenTimeout);

    do {
      try {
        const response = await axios.post(
          `${this._authUri}/api/v1/auth/accessToken`,
          null,
          {
            headers: {
              "x-client-id": this._clientId,
              "x-client-secret": this._clientSecret,
            },
          }
        );

        this._accessToken = response.data?.data;
        this._logger.info("New access token received", {
          operation: "requestToken",
        });
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error";
        this._logger.error(errorMessage, {
          operation: "requestToken",
          error: JSON.stringify(error),
        });
        await new Promise((resolve) => setTimeout(resolve, this._tokenRetry));
      }
      // eslint-disable-next-line no-constant-condition
    } while (true);

    // * Start renewing token
    const payload = decode(this._accessToken);

    const { iat, exp, uid } = payload as JwtPayload;

    this._uid = uid ? uid.toString() : undefined;

    if (!iat || !exp) return;

    // * Deplete expireIn by 60 seconds to prevent token expiring before renewing
    const expireIn = exp - iat - 60;

    this._renewTokenTimeout = setTimeout(
      () => this.requestToken(),
      expireIn * 1000
    );
  }

  async getAccessToken(renew = false): Promise<string> {
    if (!this._initialized) throw new Error("State is not initialized");
    if (renew) await this.requestToken();
    return `Bearer ${this._accessToken}`;
  }

  private async initAccessToken(options?: {
    authUri: string;
    clientId: string;
    clientSecret: string;
  }) {
    if (options === null || options === undefined)
      throw new Error(
        "accessTokenOption is required when enabling usage of accessToken"
      );

    const { authUri, clientId, clientSecret } = options;

    if (!authUri || !clientId || !clientSecret)
      throw new Error("Invalid accessTokenOptions");

    this._authUri = authUri;
    this._clientId = clientId;
    this._clientSecret = clientSecret;

    await this.requestToken();
  }

  private async requestWso2Token() {
    this._logger.info("Requesting new WSO2 access token", {
      operation: "requestWso2Token",
    });
    if (this._wso2RenewTokenTimeout) clearTimeout(this._wso2RenewTokenTimeout);

    let expiresIn;

    do {
      try {
        const response = await axios.post(
          `${this._wso2AuthUrl}/token`,
          qs.stringify({
            grant_type: this._wso2GrantType,
            scope: this._wso2Scope,
          }),
          {
            auth: {
              username: this._wso2Username,
              password: this._wso2Password,
            },
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
          }
        );

        const { data } = response;

        this._wso2AccessToken = data.access_token;
        expiresIn = data.expires_in - 60;
        this._logger.info("New WSO2 access token received", {
          operation: "wso2RequestToken",
        });
        break;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Error";
        this._logger.error(errorMessage, {
          operation: "wso2RequestToken",
          error: JSON.stringify(error),
        });
        await new Promise((resolve) =>
          setTimeout(resolve, this._wso2TokenRetry)
        );
      }
      // eslint-disable-next-line no-constant-condition
    } while (true);

    // * Deplete expireIn by 60 seconds to prevent token expiring before renewing
    this._wso2RenewTokenTimeout = setTimeout(
      () => this.requestWso2Token(),
      expiresIn * 1000
    );
  }

  async getWso2AccessToken(renew = false): Promise<string> {
    if (!this._initialized) throw new Error("State is not initialized");
    if (renew) await this.requestWso2Token();
    return this._wso2AccessToken;
  }

  private async initWso2AccessToken(options?: {
    authUrl: string;
    username: string;
    password: string;
    grantType: string;
    scope?: string;
  }) {
    if (options === null || options === undefined)
      throw new Error(
        "wso2AccessToken is required when enabling usage of accessToken"
      );

    const { authUrl, username, password, grantType, scope } = options;

    if (!authUrl || !username || !password || !grantType)
      throw new Error("Invalid wso2AccessToken");

    this._wso2AuthUrl = authUrl;
    this._wso2Username = username;
    this._wso2Password = password;
    this._wso2GrantType = grantType;
    this._wso2Scope = scope;

    await this.requestWso2Token();
  }

  private async initRedis(options?: {
    host: string;
    port: number;
    instanceType: "single" | "cluster";
    prefix: string;
  }) {
    if (options === null || options === undefined)
      throw new Error("redisOptions is required when enabling usage of Redis");

    const { host, port, instanceType, prefix } = options;

    if (!host || !port || !instanceType || !prefix)
      throw new Error("Invalid redisOptions");

    await redis.init(host, port, instanceType, prefix);
  }

  private async initQueue(options?: {
    hostname: string;
    port?: number;
    username: string;
    password: string;
    prefetch?: number;
    useMultiChannels?: boolean | false;
  }) {
    if (options === null || options === undefined)
      throw new Error("queueOptions is required when enabling usage of Queue");

    const { hostname, port, username, password, prefetch, useMultiChannels } =
      options;

    if (!hostname || !port || !username || !password)
      throw new Error("Invalid queueOptions");

    await queue.init({
      hostname,
      port,
      username,
      password,
      prefetch,
      useMultiChannels,
    });
  }

  private async initSocket(options?: {
    uri: string;
    name: string;
    type?: "agent-service" | "service" | "app";
    path?: string;
    site?: string;
    device?: string;
    lazyConnect?: boolean;
  }) {
    if (options === null || options === undefined)
      throw new Error(
        "socketOptions is required when enabling usage of Socket"
      );

    const { uri, type, name, path, site, device, lazyConnect } = options;

    if (!uri) throw new Error("Invalid socketOptions");

    socket.init(uri, type || "service", name, path, site, device, lazyConnect);
  }

  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  async init(options: StateInitOption): Promise<void> {
    // * Start getting access token
    this._options = options;
    const {
      name,
      version,
      useAccessToken,
      useWso2AccessToken,
      useSocket,
      useRedis,
      useQueue,
    } = this._options;

    if (!name || !version) throw new Error("Invalid state options");

    this.serviceName = name;
    this.serviceVersion = version;

    this._logger.init(name, version, options.logOptions);

    // * Display name and version
    this._logger.info(`Initialzing ${name}@${version}`);

    // * Set health of redis and queue
    health.redis = !useRedis;
    health.queue = !useQueue;

    if (useSocket && !useAccessToken)
      throw new Error("Socket requires Access Token feature to be enabled");

    // * Init accessToken if enabled
    if (useAccessToken) await this.initAccessToken(options.accessTokenOptions);

    // * Init wso2AccessToken if enabled
    if (useWso2AccessToken)
      await this.initWso2AccessToken(options.wso2AccessTokenOptions);

    // * Init redis if enabled
    if (useRedis) await this.initRedis(options.redisOptions);

    // * Init queue if enabled
    if (useQueue) await this.initQueue(options.queueOptions);

    this._initialized = true;

    // * Init socket
    if (useSocket) await this.initSocket(options.socketOptions);
  }

  getUserId(): string | undefined {
    return this._uid;
  }

  async close(): Promise<void> {
    // * Get options
    const { useRedis, useQueue, useSocket } = this._options || {};

    // * Create a promise array to close all connections
    const toClose: Promise<void>[] = [this._logger.end()];
    if (useRedis) toClose.push(redis.close());
    if (useQueue) toClose.push(queue.close());
    if (useSocket) toClose.push(socket.close());

    Promise.allSettled(toClose).then((results) => {
      for (const result of results) {
        if (result.status === "fulfilled") continue;

        const { reason } = result;

        const errorMessage = reason instanceof Error ? reason.message : "Error";
        this._logger.error(errorMessage, {
          operation: "gracefulShutdown",
          error: JSON.stringify(reason),
        });
      }

      this._logger.info("State closed", { operation: "close" });
    });
  }

  getServiceInfo(): { name: string; version: string } {
    return {
      name: this.serviceName,
      version: this.serviceVersion,
    };
  }
}
