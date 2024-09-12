import "reflect-metadata";
import { injectable } from "inversify";
import { EventEmitter } from "events";

import IHealth from "../interfaces/health.interface";

@injectable()
export default class Health implements IHealth {
  private _database = false;
  private _socket = false;
  private _redis = false;
  private _queue = false;
  events: EventEmitter;

  get database(): boolean {
    return this._database;
  }

  set database(healthy: boolean) {
    this._database = healthy;
    this.emitHealthStatus();
  }

  get socket(): boolean {
    return this._socket;
  }

  set socket(healthy: boolean) {
    this._socket = healthy;
    this.emitHealthStatus();
  }

  get redis(): boolean {
    return this._redis;
  }

  set redis(healthy: boolean) {
    this._redis = healthy;
    this.emitHealthStatus();
  }

  get queue(): boolean {
    return this._queue;
  }

  set queue(healthy: boolean) {
    this._queue = healthy;
    this.emitHealthStatus();
  }

  constructor() {
    this.events = new EventEmitter();
  }

  private emitHealthStatus(): void {
    this.events.emit("healthStatusChanged", this.isHealthy());
  }

  isHealthy(): boolean {
    return this._database && this._socket && this._redis && this._queue;
  }
}
