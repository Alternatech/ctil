import { Container, interfaces } from "inversify";
import { TYPES } from "./types";
import IState from "./interfaces/state.interface";
import IRedis from "./interfaces/redis.interface";
import IQueue from "./interfaces/queue.interface";
import IHealth from "./interfaces/health.interface";
import ISocket from "./interfaces/socket.interface";
import ILogger from "./interfaces/logger.interface";
import State from "./entities/state.entity";
import Redis from "./entities/redis.entity";
import Queue from "./entities/queue.entity";
import Health from "./entities/health.entity";
import Socket from "./entities/socket.entity";
import Logger from "./entities/logger.entity";

const container = new Container({
  defaultScope: "Singleton",
});
container.bind<IHealth>(TYPES.Health).to(Health);
container.bind<IState>(TYPES.State).to(State);
container.bind<ILogger>(TYPES.Logger).to(Logger);
container.bind<IRedis>(TYPES.Redis).to(Redis);
container.bind<IQueue>(TYPES.Queue).to(Queue);
container.bind<ISocket>(TYPES.Socket).to(Socket);

export const health = container.get<IHealth>(TYPES.Health);
export const state = container.get<IState>(TYPES.State);
export const logger = container.get<ILogger>(TYPES.Logger);
export const redis = container.get<IRedis>(TYPES.Redis);
export const queue = container.get<IQueue>(TYPES.Queue);
export const socket = container.get<ISocket>(TYPES.Socket);

function bind<T>(
  serviceIdentifier: interfaces.ServiceIdentifier<T>
): interfaces.BindingToSyntax<T> {
  return container.bind<T>(serviceIdentifier);
}

function get<T>(serviceIdentifier: interfaces.ServiceIdentifier<T>): T {
  return container.get<T>(serviceIdentifier);
}

export default {
  container,
  state,
  health,
  redis,
  queue,
  socket,
  logger,
  bind,
  get,
  close: state.close,
};
