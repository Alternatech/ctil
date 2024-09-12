export const TYPES: { [type: string]: symbol } = {
  State: Symbol.for("State"),
  Redis: Symbol.for("Redis"),
  Queue: Symbol.for("Queue"),
  Health: Symbol.for("Health"),
  Socket: Symbol.for("Socket"),
  Logger: Symbol.for("Logger"),
};

export default { TYPES };
