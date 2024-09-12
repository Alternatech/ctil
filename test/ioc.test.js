const { expect } = require("chai");
import nock from "nock";
const { Server } = require("socket.io");
import { container } from "../src/app";

// const token =
//   "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiI2MWQ3Yjg5ZGYxOTRhMzAwMTJkNDExODYiLCJuYW1lIjoi4LiZ4Liy4LiiIHVuZGVmaW5lZCDguYDguIjguLXguKLguKPguIHguLjguKXguJvguKPguLDguYDguKrguKPguLTguJAiLCJ1c2VybmFtZSI6InpzdXJhcGljaC5jIiwicmVmcmVzaFRva2VuSWQiOiIwOGUwOWQ2My04NmE5LTQxZjQtOWM3MS1kNjQ0OWNiMWNkM2EiLCJpYXQiOjE2NjYwNjAxNjMsInN1YiI6Ijg2ODcwM2U1LWU5N2UtNDQwMC04ZTlmLTZjNTNjODk4OTJjMSJ9.D4K5DIa8ns1EaNFvg1paYNEg-troRjM2IJFGkoZmMV0";
const token =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ1aWQiOiI2MWQ3Yjg5ZGYxOTRhMzAwMTJkNDExODYiLCJuYW1lIjoi4LiZ4Liy4LiiIHVuZGVmaW5lZCDguYDguIjguLXguKLguKPguIHguLjguKXguJvguKPguLDguYDguKrguKPguLTguJAiLCJ1c2VybmFtZSI6InpzdXJhcGljaC5jIiwicmVmcmVzaFRva2VuSWQiOiIwOGUwOWQ2My04NmE5LTQxZjQtOWM3MS1kNjQ0OWNiMWNkM2EiLCJpYXQiOjE2NjYwNjAxNjMsInN1YiI6Ijg2ODcwM2U1LWU5N2UtNDQwMC04ZTlmLTZjNTNjODk4OTJjMSJ9.g3afDZzm9-IqpL7wnMAyV4eKmayprCYaT2uQyx4DG1A";

context("IOC Container", () => {
  const tempNotificationUri = process.env.NOTIFICATIONS_URI;
  // process.env.NOTIFICATIONS_URI =
  //   "http://notifications-dev-socketio-newpos-test.apps.ocpdev.pttdigital.com" ||
  //   "http://localhost:5001";
  process.env.NOTIFICATIONS_URI = "http://localhost:5002";
  let io;

  /**
   * Setup WS & HTTP servers
   */
  before((done) => {
    io = new Server({
      // options
    });

    io.on("connection", (socket) => {
      // ...
    });

    io.listen(5001);

    io.on("connection", (socket) => {
      console.log("Client connected");
    });

    done();
  });

  /**
   *  Cleanup WS & HTTP servers
   */
  after((done) => {
    try {
      io.close();
    } catch (error) {
    } finally {
      process.env.NOTIFICATIONS_URI = tempNotificationUri;
      done();
    }
  });

  afterEach(async () => {
    await container.state.close();
  });

  describe("Initialization", () => {
    beforeEach(() => {
      nock("http://ad-pis-dev-newpos-test.apps.ocpdev.pttdigital.com")
        .matchHeader("x-client-id", "61d54d5a9ecefab60294d0c2")
        .matchHeader("x-client-secret", "d5612d3b-a5dc-49d3-8e07-16a4750e7522")
        .post("/api/v1/auth/accessToken")
        .reply(200, {
          code: "",
          msg: "",
          data: token,
        });
    });

    afterEach(() => {
      nock.cleanAll();
    });

    it("should return a container", () => {
      expect(container).to.not.be.null;
    });

    it("should have state exported", () => {
      expect(container.state).to.not.be.null;
    });

    it("should have socket exported", () => {
      expect(container.state).to.not.be.null;
    });

    it("should be able to initilize state and get token", (done) => {
      nock("http://ad-pis-dev-newpos-test.apps.ocpdev.pttdigital.com")
        .matchHeader("x-client-id", "61d54d5a9ecefab60294d0c2")
        .matchHeader("x-client-secret", "d5612d3b-a5dc-49d3-8e07-16a4750e7522")
        .post("/api/v1/auth/accessToken")
        .reply(200, {
          code: "",
          msg: "",
          data: token,
        });

      container.health.events.on("healthStatusChanged", (data) => {
        if (!data) return;
        container.health.events.removeAllListeners();
        done();
      });

      container.state
        .init({
          name: "test",
          version: "1.0.0",
          useAccessToken: true,
          accessTokenOptions: {
            authUri: process.env.AUTH_URI,
            clientId: process.env.CLIENT_ID,
            clientSecret: process.env.CLIENT_SECRET,
          },
        })
        .then(() => {
          return container.state.getAccessToken();
        })
        .then((token) => {
          expect(token).to.not.be.null;
          done();
        })
        .catch((error) => {
          done(error);
        });

      // * Simulate database health is okay
      container.health.database = true;
    });

    it("should be able to initilize state and get wso2 token", (done) => {
      container.health.events.on("healthStatusChanged", (data) => {
        if (!data) return;
        container.health.events.removeAllListeners();
        done();
      });

      container.state
        .init({
          name: "test",
          version: "1.0.0",
          useWso2AccessToken: true,
          wso2AccessTokenOptions: {
            authUrl: "https://apimgw-dev.pttgrp.com",
            username: "0wml_A5eT4Y9gUpz1Tw7X2e9tdAa",
            password: "dfIqo9J4T8yu1FTNFdJQeY_SRXka",
            grantType: "client_credentials",
            scope: "1234343434",
          },
        })
        .then(() => {
          return container.state.getWso2AccessToken();
        })
        .then((token) => {
          expect(token).to.not.be.null;
          done();
        })
        .catch((error) => {
          done(error);
        });

      // * Simulate database health is okay
      container.health.database = true;
    });

    it("should be able to get userId", () => {
      expect(container.state.getUserId).to.not.be.null.and.equal(
        "61d7b89df194a30012d41186"
      );
    });

    it("should be able to wso token", async () => {
      expect(container.state.getWso2AccessToken).to.not.be.null.and.equal(
        "61d7b89df194a30012d41186"
      );
    });
  });

  // ! For internal testing purposes
  describe.skip("SocketIO", () => {
    context("Normal case", () => {
      before(function (done) {
        nock("http://ad-pis-dev-newpos-test.apps.ocpdev.pttdigital.com")
          .matchHeader("x-client-id", "61d54d5a9ecefab60294d0c2")
          .matchHeader(
            "x-client-secret",
            "d5612d3b-a5dc-49d3-8e07-16a4750e7522"
          )
          .post("/api/v1/auth/accessToken")
          .reply(200, {
            code: "",
            msg: "",
            data: token,
          });

        container.health.events.on("healthStatusChanged", (data) => {
          if (!data) return;
          container.health.events.removeAllListeners();
          done();
        });

        container.state
          .init({
            name: "test",
            version: "1.0.0",
            useAccessToken: true,
            accessTokenOptions: {
              authUri: process.env.AUTH_URI,
              clientId: process.env.CLIENT_ID,
              clientSecret: process.env.CLIENT_SECRET,
            },
            useWso2AccessToken: true,
            wso2AccessTokenOptions: {
              authUrl: "https://apimgw-dev.pttgrp.com",
              username: "0wml_A5eT4Y9gUpz1Tw7X2e9tdAa",
              password: "dfIqo9J4T8yu1FTNFdJQeY_SRXka",
              grantType: "client_credentials",
              scope: "1234343434",
            },
            // ! Use actual production uri for testing actual use
            useSocket: true,
            socketOptions: {
              uri: process.env.NOTIFICATIONS_URI,
              name: "test",
              type: "service",
            },
            useRedis: false,
            useQueue: false,
          })
          .then(() => {})
          .catch((error) => {
            console.log(error);
          });

        container.health.database = true;
      });

      // ! Skip this test, since the test socket server does not support this
      it("should be able to send message and receive message", (done) => {
        // * Test sending message to itself
        const listener = (message, sender, callback) => {
          expect(message).to.eql("message");
          expect(sender).to.not.be.undefined;

          if (callback)
            callback({ message: "Well received :)", isError: false });

          // * Remove listener
          container.socket.off("event", listener);
        };

        container.socket.on("event", listener);

        container.socket
          .emit(
            {
              type: "service",
              name: "test",
              broadcast: false,
            },
            "event",
            "message"
          )
          .then((result) => {
            expect(result).to.haveOwnProperty("from").and.eql("test");
            expect(result)
              .to.haveOwnProperty("message")
              .and.eql("Well received :)");

            done();
          });
      });

      it("should receive a error if receiptent does not exist", () => {
        container.socket
          .emit(
            {
              type: "service",
              name: "unknown",
              broadcast: false,
            },
            "event",
            "message"
          )
          .then((result) => {
            expect(result.error).to.exist.and.eql("Recipient does not exist");
            done();
          });
      });

      it.skip("should be able to get new token when reconnecting", function (done) {
        this.timeout(5000);

        io.disconnectSockets();

        container.health.events.on("healthStatusChanged", (data) => {
          console.log("socket healthy", container.health.socket);

          if (!container.health.socket) return;

          container.health.events.removeAllListeners();
          done();
        });
      });
    });

    context("Lazy Connect", () => {
      before(function (done) {
        nock("http://ad-pis-dev-newpos-test.apps.ocpdev.pttdigital.com")
          .matchHeader("x-client-id", "61d54d5a9ecefab60294d0c2")
          .matchHeader(
            "x-client-secret",
            "d5612d3b-a5dc-49d3-8e07-16a4750e7522"
          )
          .post("/api/v1/auth/accessToken")
          .reply(200, {
            code: "",
            msg: "",
            data: token,
          });

        container.state
          .init({
            name: "test",
            version: "1.0.0",
            useAccessToken: true,
            accessTokenOptions: {
              authUri: process.env.AUTH_URI,
              clientId: process.env.CLIENT_ID,
              clientSecret: process.env.CLIENT_SECRET,
            },
            // ! Use actual production uri for testing actual use
            useSocket: true,
            socketOptions: {
              uri: "http://localhost:5002",
              name: "test",
              type: "service",
              lazyConnect: true,
            },
            useRedis: false,
            useQueue: false,
          })
          .then(() => {
            done();
          })
          .catch((error) => {
            console.log(error);
          });

        container.health.database = true;
      });

      it("should be able to lazy connect socket", (done) => {
        container.health.events.on("healthStatusChanged", (data) => {
          if (!data) return;
          container.health.events.removeAllListeners();

          expect(container.socket.site).to.eql("siteTest");
          expect(container.socket.device).to.eql("deviceTest");
          done();
        });

        container.socket.site = "siteTest";
        container.socket.device = "deviceTest";
        container.socket.connect();
      });
    });
  });

  describe.skip("Queue", () => {
    before((done) => {
      nock(process.env.AUTH_URI)
        .matchHeader("x-client-id", process.env.CLIENT_ID)
        .matchHeader("x-client-secret", process.env.CLIENT_SECRET)
        .post("/api/v1/auth/accessToken")
        .reply(200, {
          code: "",
          msg: "",
          data: token,
        })
        .persist();

      container.health.events.on("healthStatusChanged", (data) => {
        if (!container.health.queue) return;
        container.health.events.removeAllListeners();
        done();
      });

      container.state.init({
        name: "test",
        version: "0.0.0",
        useAccessToken: true,
        accessTokenOptions: {
          authUri: process.env.AUTH_URI,
          clientId: process.env.CLIENT_ID,
          clientSecret: process.env.CLIENT_SECRET,
        },
        useSocket: false,
        socketOptions: {
          uri: process.env.NOTIFICATIONS_URI,
        },
        useQueue: true,
        queueOptions: {
          hostname: process.env.QUEUE_HOST,
          username: "guest",
          password: "guest",
          port: process.env.QUEUE_PORT,
          prefetch: 1,
        },
      });

      // * Simulate database health is okay
      container.health.database = true;
    });

    after(() => {
      nock.cleanAll();
    });

    it("should be able to initialize queue instance", async () => {
      expect(container.queue.initialized).to.be.true;
    });

    it("should be able to publish exchange", async () => {
      await container.queue.assertExchange("exchange", "direct");
      container.queue.publishToExchange("exchange", "", "message", {
        "x-temp": "",
      });
    });

    it("should be able to consume queues", function (done) {
      container.queue.assertQueue("queue").then(() => {
        container.queue.consume("queue", (message) => {
          expect(message).to.not.be.null;
          done();
        });

        container.queue.publishToQueue("queue", "message");
      });
    });

    it("should be able to get message from queue using getMessage", async () => {
      await container.queue.assertQueue("queue");
      await container.queue.publishToQueue("queue", "message");
      const message = await container.queue.getMessage("queue");
      await container.queue.ack(message);

      expect(message).to.not.be.null;
    });
  });

  describe.skip("Logger", () => {
    it("should be able to log properly", () => {
      container.logger.info("Test", {
        operation: "test",
        correlationId: "1234-1234-1234-1234",
      });
    });
  });
});
