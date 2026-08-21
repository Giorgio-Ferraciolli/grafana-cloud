import { NextFunction, Request, Response } from "express";
import { logger } from "../utils/logger";
import { httpErrorsTotal, httpRequestDuration, httpRequestsTotal } from "../metrics";

/**
 * Structured access log + HTTP metrics for every request. Uses the matched
 * route pattern (not the raw URL) as a label so `/api/users/:id` doesn't
 * explode metric cardinality per user id.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
    const attributes = {
      "http.method": req.method,
      "http.route": route,
      "http.status_code": res.statusCode,
    };

    httpRequestsTotal.add(1, attributes);
    httpRequestDuration.record(durationMs, attributes);
    if (res.statusCode >= 400) httpErrorsTotal.add(1, attributes);

    logger.info(
      {
        "http.method": req.method,
        "http.route": route,
        "http.status_code": res.statusCode,
        duration_ms: Math.round(durationMs * 100) / 100,
      },
      `${req.method} ${route} ${res.statusCode}`
    );
  });

  next();
}
