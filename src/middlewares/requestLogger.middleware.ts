/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/ban-types */
import container from "../container";
import { Request, Response, NextFunction } from "express";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getActualRequestDurationInMilliseconds = (start: any) => {
  const NS_PER_SEC = 1e9; //  convert to nanoseconds
  const NS_TO_MS = 1e6; // convert to milliseconds
  const diff = process.hrtime(start);
  return (diff[0] * NS_PER_SEC + diff[1]) / NS_TO_MS;
};

const logRequest = (req: Request) => {
  const correlationId = req.headers["x-correlation-id"];

  let requestBody = "";
  try {
    if (!!req.body && req.body.constructor === Object) {
      requestBody = JSON.stringify(req.body);
    } else {
      requestBody = req.body;
    }
  } catch (err: unknown) {
    /* istanbul ignore next */
    requestBody = req.body;
  }

  container.logger.info(`HTTP ${req.method} ${req.originalUrl}`, {
    operation: "HTTP Request",
    correlationId: correlationId ? (correlationId as string) : "",
    req: {
      url: req.url,
      headers: req.headers,
      method: req.method,
      httpVersion: req.httpVersion,
      originalUrl: req.originalUrl,
      query: req.query,
      body: requestBody,
    },
  });
};

const logResponse = (
  req: Request,
  res: Response,
  chunks: Buffer[],
  duration = "0",
  isIgnoreResponseBodyLogging = false
) => {
  const correlationId = req.headers["x-correlation-id"];

  const logResponseData: {
    statusCode: number;
    body?: string;
  } = {
    statusCode: res.statusCode,
  };

  if (!isIgnoreResponseBodyLogging)
    logResponseData["body"] = Buffer.concat(chunks).toString("utf8");

  container.logger.info(
    `HTTP ${res.statusCode} ${req.method} ${req.originalUrl} ${duration}ms`,
    {
      operation: "HTTP Response",
      correlationId: correlationId ? (correlationId as string) : "",
      res: logResponseData,
    }
  );
};

// CustomRequest type with the augmented headers
type CustomRequest<T = any> = Request<T> & {
  headers: {
    [key: string]: string | string[] | undefined | boolean;
    "x-ignore-response-body-logging"?: boolean;
  };
};

export function requestLogger(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const startingHRTime = process.hrtime();

    if (req.originalUrl !== "/healthCheck") {
      logRequest(req);
    }

    const [oldWrite, oldEnd] = [res.write, res.end];
    const chunks: Buffer[] = [];

    (res.write as unknown) = function (chunk: ArrayBuffer | SharedArrayBuffer) {
      chunks.push(Buffer.from(chunk));
      (oldWrite as Function).apply(res, arguments);
    };

    (res.end as unknown) = function (chunk: ArrayBuffer | SharedArrayBuffer) {
      if (chunk) {
        chunks.push(Buffer.from(chunk));
      }

      try {
        const _ignoreResponseBodyLogging =
          req.headers["x-ignore-response-body-logging"] === true;
        if (req.originalUrl !== "/healthCheck") {
          const duration =
            getActualRequestDurationInMilliseconds(
              startingHRTime
            ).toLocaleString();

          logResponse(req, res, chunks, duration, _ignoreResponseBodyLogging);
        }

        (oldEnd as Function).apply(res, arguments);
      } catch (error) {
        const err = error as Error;
        container.logger.error(`${err.message}`, {
          error: JSON.stringify(error),
        });
        (oldEnd as Function).apply(res, arguments);
      }
    };
  } catch (error) {
    const err = error as Error;
    container.logger.error(`${err.message}`, { error: JSON.stringify(error) });
  } finally {
    next();
  }
}

// Middleware function to ignore response body logging
export function ignoreResponseBodyLogging(
  req: CustomRequest,
  res: Response,
  next: NextFunction
): void {
  req.headers["x-ignore-response-body-logging"] = true;
  next();
}
