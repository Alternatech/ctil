export type StateInitOption = {
  /**
   * Service name
   */
  name: string;
  /**
   * Service version
   */
  version: string;
  /**
   * @description Optional log options
   */
  logOptions?: {
    /**
     * @description Define if to enable daily file rotation, intentionally used for services that don't run on the cloud
     * @default false
     */
    enableDailyFileRotation?: boolean;
    /**
     * @description Define if to enable elasticsearch logging
     * @default true
     */
    enableElasticsearchTransport?: boolean;
  };
  useSocket: boolean;
  socketOptions?: {
    uri: string;
    path?: string;
    type: "service" | "agent-service" | "app";
    name: string;
    site?: string;
    device?: string;
    lazyConnect?: boolean;
  };
  /**
   * @description Enable to generate access token for internal use, if true then `accessTokenOption` must be provided
   */
  useAccessToken: boolean;
  accessTokenOptions?: {
    authUri: string;
    clientId: string;
    clientSecret: string;
    retry?: number;
  };
  /**
   * @description Enable to use redis and socket.io, if true then `redisOption` must be provided
   */
  useRedis: boolean;
  /**
   * @description Enable to use queue, if true then `queueOption` must be provided
   */
  useQueue: boolean;
  /**
   * @description Enable to generate access WSO2 token for internal use, if true then `wso2AccessTokenOptions` must be provided
   * @param useWso2AccessToken boolean for enable to generate access WSO2 token
   */
  useWso2AccessToken?: boolean;
  /**
   * @description Redis options when useRedis is true
   */
  redisOptions?: {
    host: string;
    port: number;
    instanceType: "single" | "cluster";
    prefix: string;
  };
  /**
   * @description Queue options when useQueue is true
   */
  queueOptions?: {
    hostname: string;
    port?: number;
    username: string;
    password: string;
    prefetch?: number;
    useMultiChannels?: boolean | false;
  };
  /**
   * @description wso2AccessTokenOptions options when useWso2AccessToken is true
   * @param authUrl url for access to get WSO2 token
   * @param username username of WS02 for Authorization
   * @param password password of WS02 for Authorization
   * @param grantType body to send to receive WSO2 tokens
   * @param scope body to send to receive WSO2 tokens (optional)
   */
  wso2AccessTokenOptions?: {
    authUrl: string;
    username: string;
    password: string;
    grantType: string;
    scope?: string;
  };
};

interface IState {
  serviceName: string;
  serviceVersion: string;
  configs: Record<string, unknown>;

  init(options: StateInitOption): Promise<void>;

  /**
   * Get access token
   * @param renew true: renew token, false: get token
   */
  getAccessToken(renew?: boolean): Promise<string>;

  /**
   * Get wso2 access token
   * @param renew true: renew token, false: get token
   */
  getWso2AccessToken(renew?: boolean): Promise<string>;

  getUserId(): string | undefined;

  /**
   * Used for graceful shutdown process
   */
  close(): Promise<void>;

  /**
   * Get current service information
   */
  getServiceInfo(): { name: string; version: string };
}

export default IState;
