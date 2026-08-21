import { NextFunction, Request, Response } from "express";
import { trace } from "@opentelemetry/api";
import { AppError, ValidationError } from "../utils/errors";
import { logger } from "../utils/logger";

const isProduction = process.env.NODE_ENV === "production";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: "NotFound",
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function globalErrorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  const span = trace.getActiveSpan();
  const error = err instanceof Error ? err : new Error("Unknown error");

  span?.recordException(error);

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const expose = err instanceof AppError ? err.expose : false;

  logger.error(
    {
      err: { name: error.name, message: error.message, stack: error.stack },
      "http.status_code": statusCode,
    },
    "unhandled request error"
  );

  const body: Record<string, unknown> = {
    error: error.name || "InternalServerError",
    message: expose || !isProduction ? error.message : "Something went wrong. Please try again later.",
  };

  if (err instanceof ValidationError && err.details) {
    body.details = err.details;
  }

  if (!isProduction && !expose) {
    body.stack = error.stack;
  }

  res.status(statusCode).json(body);
}
