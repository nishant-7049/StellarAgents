import { Request, Response, NextFunction } from "express";
import { logger } from "../logger.js";

export function loggerMiddleware(req: Request, _res: Response, next: NextFunction) {
  logger.debug(`${req.method} ${req.path}`);
  next();
}
