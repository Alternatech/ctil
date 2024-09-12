import "reflect-metadata";
import { injectable } from "inversify";
import winston, { format } from "winston";
import {
  ElasticsearchTransport,
  ElasticsearchTransformer,
  LogData,
} from "winston-elasticsearch";
import ILogger, { LogMetaType } from "../interfaces/logger.interface";
import DailyRotateFile from "winston-daily-rotate-file";

@injectable()
export default class Logger implements ILogger {
  private _initialized = false;
  private logger!: winston.Logger;
  private serviceName = "";
  private serviceVersion = "0.0.0";

  private _defaultMeta: Partial<LogMetaType> = {
    correlationId: "",
    function: "",
    others: {},
  };

  init(
    serviceName: string,
    serviceVersion: string,
    options?: {
      enableDailyFileRotation?: boolean;
      enableElasticsearchTransport?: boolean;
    }
  ): void {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;

    const { colorize } = winston.format;
    const timestampFormat = format.timestamp({
      format: "YYYY-MM-DD HH:mm:ss",
    });

    /* istanbul ignore next */
    const printfFormat = format.printf((info) => {
      const { timestamp, level, message, ...meta } = info;
      if (!meta) {
        return `${timestamp} [${process.pid}] ${level}: ${message}`;
      }

      const { operation, correlationId } = meta;

      const prefixPart = `${timestamp} [${process.pid}] ${level}:`;
      const operationPart = operation ? ` [${operation}]` : "";
      const messagePart = ` ${message}`;
      const correlationIdPart = correlationId
        ? ` - correlationId::${correlationId}`
        : "";

      return `${prefixPart}${operationPart}${messagePart}${correlationIdPart}`;
    });

    const consoleFormat =
      process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test"
        ? /* istanbul ignore next */ format.combine(
            timestampFormat,
            printfFormat
          )
        : format.combine(colorize(), timestampFormat, printfFormat);

    const transports: winston.transport[] = [];

    /* istanbul ignore else */
    if (process.env.NODE_ENV === "test") {
      transports.push(
        new winston.transports.File({
          filename: "./logs/tests.log",
          format: consoleFormat,
          handleExceptions: true,
        })
      );
    }

    /* istanbul ignore if */
    if (process.env.NODE_ENV === "development") {
      // * Add console transport
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
          handleExceptions: true,
        })
      );
    }

    /* istanbul ignore if */
    if (process.env.NODE_ENV === "production") {
      // * Add console transport
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
          handleExceptions: true,
        })
      );

      // * Add elasticsearch transport if enabled
      const enableElasticsearchTransport =
        !options || options.enableElasticsearchTransport;
      if (enableElasticsearchTransport)
        transports.push(this.getElasticsearchTransport());

      // * Add a daily file rotation transport if enabled
      if (options && options.enableDailyFileRotation)
        transports.push(...this.getDailyFileRotationTransports(consoleFormat));
    }

    this.logger = winston.createLogger({
      transports,
    });

    this._initialized = true;
  }

  private transformELKLogData(logData: LogData) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transformed = ElasticsearchTransformer(logData) as any;
    transformed["@version"] = this.serviceVersion;
    transformed["pid"] = process.pid;
    transformed["kubernetes.pod.name"] = process.env.K8S_POD_NAME || "";

    const { correlationId, operation, errors: error } = logData.meta;

    if (correlationId) transformed["correlationId"] = correlationId;
    if (operation) transformed["operation"] = operation;
    if (error) {
      let _error = error;
      if (typeof error !== "string") _error = JSON.stringify(error);
      transformed["error"] = _error;
    }

    delete logData.meta.correlationId;
    delete logData.meta.function;

    return transformed;
  }

  private getElasticsearchTransport() {
    const index = `logs-pttdigital-${this.serviceName.replace(
      "pttdigital.pos.oil.",
      ""
    )}`;

    const esTransport = new ElasticsearchTransport({
      level: "info",
      clientOpts: {
        node: process.env.ELASTICSEARCH_URI,
        auth: {
          username: process.env.ELASTICSEARCH_USERNAME || "",
          password: process.env.ELASTICSEARCH_PASSWORD || "",
        },
      },
      index,
      indexPrefix: this.serviceName,
      dataStream: true,
      transformer: this.transformELKLogData,
      indexTemplate: {
        priority: 200,
        template: {
          settings: {
            index: {
              mapping: {
                total_fields: {
                  limit: "3000",
                },
              },
              refresh_interval: "5s",
              number_of_shards: "1",
              number_of_replicas: "0",
            },
          },
          mappings: {
            _source: {
              enabled: true,
            },
            properties: {
              severity: {
                index: true,
                type: "keyword",
              },
              source: {
                index: true,
                type: "keyword",
              },
              "@timestamp": {
                type: "date",
              },
              "@version": {
                type: "keyword",
              },
              fields: {
                dynamic: true,
                type: "object",
              },
              message: {
                index: true,
                type: "text",
              },
              "kubernetes.pod.name": {
                index: true,
                type: "text",
              },
              pid: {
                index: true,
                type: "int",
              },
              correlationId: {
                index: true,
                type: "text",
              },
              operation: {
                index: true,
                type: "text",
              },
              error: {
                index: false,
                type: "text",
              },
            },
          },
        },
        index_patterns: [`${index}*`],
        data_stream: {},
        composed_of: [],
      },
    });

    esTransport.on("error", (error) => {
      // eslint-disable-next-line no-console
      console.error(`Logger error: ${error.message}`);
    });

    return esTransport;
  }

  private getDailyFileRotationTransports(
    logFormat: winston.Logform.Format
  ): winston.transport[] {
    const tmp = [];

    // * All level log file
    tmp.push(
      new DailyRotateFile({
        filename: "backlogs-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        format: logFormat,
        dirname: "./logs/apps",
      })
    );

    // * Error level only log file
    tmp.push(
      new DailyRotateFile({
        level: "error",
        filename: "errors-%DATE%.log",
        datePattern: "YYYY-MM-DD",
        format: logFormat,
        dirname: "./logs/errors",
      })
    );

    return tmp;
  }

  info(message: string, meta?: Partial<LogMetaType> | undefined): void {
    if (!this._initialized) throw new Error("Logger not initialized");
    this.logger.info(message, { ...this._defaultMeta, ...meta });
  }

  error(message: string, meta?: Partial<LogMetaType> | undefined): void {
    if (!this._initialized) throw new Error("Logger not initialized");
    this.logger.error(message, { ...this._defaultMeta, ...meta });
  }

  debug(message: string, meta?: Partial<LogMetaType> | undefined): void {
    if (!this._initialized) throw new Error("Logger not initialized");
    this.logger.debug(message, { ...this._defaultMeta, ...meta });
  }

  warn(message: string, meta?: Partial<LogMetaType> | undefined): void {
    if (!this._initialized) throw new Error("Logger not initialized");
    this.logger.warn(message, { ...this._defaultMeta, ...meta });
  }

  async end(): Promise<void> {
    if (!this._initialized) return;

    return new Promise((resolve) => {
      this.logger.end(() => {
        resolve();
      });
    });
  }
}
