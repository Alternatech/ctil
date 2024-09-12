/* eslint-disable @typescript-eslint/no-unused-vars*/

import { container, CustomException } from "../app";
import { Request, Response, NextFunction } from "express";
import responsio from "responsio";

function errorHandler(
  error: CustomException,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    /* istanbul ignore next */
    if (!error.statusCode) {
      /* istanbul ignore next */
      throw error;
    }
    const { message, statusCode, code, responsioData, _metadata } = error;

    container.logger.error(error.message);

    return res
      .status(statusCode)
      .respond(code, message, responsioData, _metadata);
  } catch (_err) {
    const err = _err as Error;
    /* istanbul ignore next */
    container.logger.error(err.message);
    /* istanbul ignore next */
    return res.status(500).respond("XX-00-0099", err.message, null, null);
  }
}

export default errorHandler;
