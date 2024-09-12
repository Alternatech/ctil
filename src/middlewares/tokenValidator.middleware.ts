import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

function validateToken(secret: string) {
  return function (req: Request, res: Response, next: NextFunction): void {
    // * Check if header has token
    const authorization = req.headers["authorization"];

    if (!authorization || !authorization.includes("Bearer")) {
      res.status(401).send({
        code: "XX-00-0013",
        msg: "Unauthorized",
      });
      return;
    }

    const token = authorization.replace("Bearer ", "");

    // * Decode token
    try {
      const decoded = jwt.verify(token, secret);

      // * Get claims and add to headers
      const { uid, station, device } = decoded as jwt.JwtPayload;
      req.headers["x-uid"] = req.headers["x-uid"] || uid || "";
      req.headers["x-station"] = req.headers["x-station"] || station || "";
      req.headers["x-device"] = req.headers["x-device"] || device || "";

      next && next();
    } catch (error) {
      res.status(401).send({
        code: "XX-00-0013",
        msg: "Unauthorized",
        error,
      });
      return;
    }
  };
}

export default validateToken;
