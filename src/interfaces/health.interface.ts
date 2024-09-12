import { EventEmitter } from "events";

interface IHealth {
  events: EventEmitter;
  database: boolean;
  socket: boolean;
  redis: boolean;
  queue: boolean;
  isHealthy(): boolean;
}

export default IHealth;
