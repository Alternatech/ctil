const { default: mongoose } = require("mongoose");
const { GenericContainer } = require("testcontainers");

let redisContainer;
let queueContainer;

// * MongoDB container
async function startMongoServer() {
  global.mongoContainer = await new GenericContainer("mongo:4.4.2")
    .withExposedPorts(27017)
    .start();

  const mongoUrl = `mongodb://127.0.0.1:${global.mongoContainer.getMappedPort(
    27017
  )}`;
  // const mongoUrl =
  //   "mongodb://localhost:27017/?readPreference=primary&appname=MongoDB%20Compass&ssl=false";

  await mongoose.connect(mongoUrl, { dbName: "HORIZON" });
}

// * Redis container
async function startRedis() {
  redisContainer = await new GenericContainer("redis")
    .withExposedPorts(6379)
    .start();
  process.env.REDIS_HOST = redisContainer.getHost();
  process.env.REDIS_PORT = redisContainer.getMappedPort(6379);
}

async function startRabbitMq() {
  redisContainer = await new GenericContainer("rabbitmq:3")
    .withExposedPorts(5672)
    .start();
  process.env.QUEUE_HOST = redisContainer.getHost();
  process.env.QUEUE_PORT = redisContainer.getMappedPort(5672);
}

exports.mochaGlobalSetup = async function () {
  process.env.AUTH_URI =
    "http://ad-pis-dev-newpos-test.apps.ocpdev.pttdigital.com";
  process.env.CLIENT_ID = "61d54d5a9ecefab60294d0c2";
  process.env.CLIENT_SECRET = "d5612d3b-a5dc-49d3-8e07-16a4750e7522";

  // ! Can comment this line when developing
  await startMongoServer();
  await startRedis();
  await startRabbitMq();
};

exports.mochaGlobalTeardown = async function () {
  if (global.mongoContainer) await global.mongoContainer.stop();
  if (redisContainer) await redisContainer.stop();
  if (queueContainer) await queueContainer.stop();
};
