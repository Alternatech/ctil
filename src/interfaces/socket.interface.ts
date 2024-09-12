export type SocketClientType = {
  broadcast?: boolean;
  type: "service" | "agent-service" | "app" | "user";
  name?: string;
  site?: string;
  device?: string;
  uid?: string;
};

export type SocketEmitReturnType = {
  from: string;
  message?: unknown;
  error?: unknown;
};

export type SocketListenerCallbackResponseType = {
  message?: unknown;
  error?: unknown;
};

export interface SocketListener {
  (
    message: unknown,
    sender?: Partial<SocketClientType>,
    callback?: (response: SocketListenerCallbackResponseType) => void
  ): void;
}

interface ISocket {
  site?: string;
  device?: string;

  /**
   * Used internally to initialize the socket
   */
  init(
    uri: string,
    type: "agent-service" | "service" | "app",
    name: string,
    path?: string,
    site?: string,
    device?: string,
    lazyConnect?: boolean
  ): Promise<void>;

  /**
   * Manually connect to socket, only use this if you set lazyConnect to true
   */
  connect(): void;

  /**
   * Emit socket messages to specified clients
   * @description Check https://www.notion.so/pttnewpos/Sending-Messages-682855ca93204f66973342df5a31fd67 for more details
   * @param to Client to send message to
   * @param event Event name
   * @param message Messages to send
   */
  emit(
    to: SocketClientType,
    event: string,
    message: unknown
  ): Promise<SocketEmitReturnType>;

  /**
   * Listen to an `event`
   * @param event Name of event
   * @param listener Callback function
   */
  on(event: string, listener: SocketListener): void;

  /**
   * Removes the `listener` function as an event listener for `event`
   * @param event Name of event
   * @param listener Callback function
   */
  off(event: string, listener: SocketListener): void;

  close(): Promise<void>;
}

export default ISocket;
