import "reflect-metadata";
import { getSocketRecipient } from "./../app";
import { TYPES } from "../types";
import { inject, injectable } from "inversify";
import ISocket, {
  SocketClientType,
  SocketEmitReturnType,
  SocketListener,
} from "../interfaces/socket.interface";
import IState from "../interfaces/state.interface";
import IHealth from "../interfaces/health.interface";
import { io, Socket as SocketClient } from "socket.io-client";
import { DefaultEventsMap } from "@socket.io/redis-emitter/dist/typed-events";
import ILogger from "../interfaces/logger.interface";

@injectable()
export default class Socket implements ISocket {
  private _state: IState;
  private _health: IHealth;
  private _logger: ILogger;
  private _initialized = false;
  private _sender: SocketClientType;
  private _site?: string;
  private _device?: string;
  private _socketConnectingBoundCallback: () => void;
  private _socketConnectedBoundCallback: () => void;
  private _socketDisconnectedBoundCallback: (reason: string) => void;
  private _socketErrorBoundCallback: (error: unknown) => void;
  socket!: SocketClient<DefaultEventsMap, DefaultEventsMap>;

  public set site(v: string | undefined) {
    if (this._initialized)
      throw new Error(
        "Cannot set site since socket has has already been initialized"
      );

    this.socket.io.opts.query = {
      ...this.socket.io.opts.query,
      site: v,
    };
    this._site = v;
  }

  public get site(): string | undefined {
    return this._site;
  }

  public set device(v: string | undefined) {
    if (this._initialized)
      throw new Error(
        "Cannot set device since socket has has already been initialized"
      );

    this.socket.io.opts.query = {
      ...this.socket.io.opts.query,
      device: v,
    };
    this._device = v;
  }

  public get device(): string | undefined {
    return this._device;
  }

  constructor(
    @inject(TYPES.State) state: IState,
    @inject(TYPES.Health) health: IHealth,
    @inject(TYPES.Logger) logger: ILogger
  ) {
    this._state = state;
    this._health = health;
    this._logger = logger;
    this._health.socket = false;
    this._sender = {
      type: "service",
      name: this._state.serviceName,
    };
    this._socketConnectedBoundCallback = this.onSocketConnected.bind(this);
    this._socketConnectingBoundCallback = this.onSocketConnecting.bind(this);
    this._socketDisconnectedBoundCallback =
      this.onSocketDisconnected.bind(this);
    this._socketErrorBoundCallback = this.onSocketError.bind(this);
  }

  private async connectToSocket(): Promise<void> {
    this._logger.info("Connecting/reconnecting to socket server");

    this.socket.auth = {
      token: (await this._state.getAccessToken()).replace("Bearer ", ""),
    };
    this.socket.connect();
  }

  private onSocketConnected(): void {
    this._health.socket = true;
    this._logger.info("Connected/reconnected to socket server");
  }

  private async onSocketConnecting(): Promise<void> {
    this._health.socket = false;
  }

  private async onSocketDisconnected(reason: string): Promise<void> {
    this._health.socket = false;
    this._logger.info(`Disconnected from socket server, reason: ${reason}`);

    if (reason === "io client disconnect") return;

    // * Delay 3 seconds before reconnecting
    setTimeout(() => {
      this.connectToSocket();
    }, 3000);
  }

  private onSocketError(error: unknown): void {
    this._health.socket = false;
    this._logger.error("Socket error occured", {
      error: JSON.stringify(error),
    });

    // * Attempt reconnection
    setTimeout(() => {
      this.connectToSocket();
    }, 3000);
  }

  async init(
    uri: string,
    type: "agent-service" | "service",
    name: string,
    path?: string,
    site?: string,
    device?: string,
    lazyConnect = false
  ): Promise<void> {
    if (this._initialized) {
      this._logger.warn("Socket has already been initialized!");
      return;
    }

    // * Get version of application
    const { version } = this._state.getServiceInfo();

    this.socket = io(uri, {
      path: path || "/socket.io",
      transports: ["websocket"],
      query: {
        type,
        name,
        site,
        device,
        version,
      },
      auth: {
        token: (await this._state.getAccessToken()).replace("Bearer ", ""),
      },
      autoConnect: false,
      reconnection: false,
    });

    // * Binding socketio events
    this.socket.on("connect", this._socketConnectedBoundCallback);
    this.socket.on("reconnect", this._socketConnectedBoundCallback);

    // * Reconnecting
    this.socket.on("reconnect_attempt", this._socketConnectingBoundCallback);

    // * Error events
    this.socket.on("error", this._socketErrorBoundCallback);
    this.socket.on("connect_error", this._socketErrorBoundCallback);
    this.socket.on("reconnect_error", this._socketErrorBoundCallback);
    this.socket.on("reconnect_failed", this._socketErrorBoundCallback);

    // * Disconnect events
    this.socket.on("disconnect", this._socketDisconnectedBoundCallback);

    // * Start connection
    if (lazyConnect) return;

    this.connectToSocket();
    this._initialized = true;
  }

  connect(): void {
    if (this._initialized) {
      this._logger.error("Socket has already been initialized!");
      return;
    }

    this.connectToSocket();
    this._initialized = true;
  }

  emit(
    to: SocketClientType,
    event: string,
    message: unknown
  ): Promise<SocketEmitReturnType> {
    if (!this._initialized) {
      throw new Error("Socket has not yet been initialized");
    }

    const _socket = this.socket;

    return new Promise((resolve, reject) => {
      if (!_socket.connected)
        resolve({
          from: "self",
          error: "Not connected to socket",
        });

      // * Validate `to`
      const receipent = getSocketRecipient(to);

      if (!receipent) reject("Unable to contruct recipient");

      _socket.emit(
        "message",
        {
          to,
          event,
          message,
        },
        this._sender,
        (response: SocketEmitReturnType) => {
          resolve(response);
        }
      );

      return true;
    });
  }

  on(event: string, listener: SocketListener): void {
    if (!this._initialized) {
      this._logger.error("Socket has not been initialized yet");
      throw new Error("Socket has not been initialized yet");
    }

    this.socket.on(event, listener);
  }

  off(event: string, listener?: SocketListener): void {
    if (!this._initialized) {
      this._logger.error("Socket has not been initialized yet");
      throw new Error("Socket has not been initialized yet");
    }

    this.socket.off(event, listener);
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      this.socket.disconnect();
      resolve();
    });
  }
}
