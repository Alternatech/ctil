type PredefinedMetaType = {
  correlationId: string;
  operation: string;
  error: string;
  req: unknown;
  res: unknown;
};

type OtherMetaType = { [key: string]: unknown };

export type LogMetaType = PredefinedMetaType & OtherMetaType;

interface ILogger {
  init(
    serviceName: string,
    serviceVersion: string,
    options?: {
      enableDailyFileRotation?: boolean;
      enableElasticsearchTransport?: boolean;
    }
  ): void;

  info(message: string, meta?: Partial<LogMetaType>): void;

  error(message: string, meta?: Partial<LogMetaType>): void;

  debug(message: string, meta?: Partial<LogMetaType>): void;

  warn(message: string, meta?: Partial<LogMetaType>): void;

  end(): Promise<void>;
}

export default ILogger;
