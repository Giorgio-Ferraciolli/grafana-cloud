import { Request, Response } from "express";
import { prisma } from "../database/prismaClient";
import { AppError } from "../utils/errors";
import { withSpan } from "../utils/tracing";
import { logger } from "../utils/logger";

const MAX_SIMULATED_DELAY_MS = 5000;

/**
 * Lab-only endpoint: deliberately throws so you can see how an unhandled
 * exception looks end-to-end (span exception event, 500 log, error metric).
 */
export async function debugErrorHandler(_req: Request, _res: Response): Promise<void> {
  logger.warn({ "lab.simulated": true }, "debug endpoint intentionally raising an error");
  throw new AppError("This is an intentionally triggered lab error (GET /api/debug/error).", 500, true);
}

/**
 * Lab-only endpoint: runs a real MySQL `SELECT SLEEP(n)` inside its own
 * span so you can observe what a slow database call looks like in a trace,
 * without touching any real application data. Delay is clamped to keep the
 * lab endpoint from being usable to hang the connection pool.
 */
export async function debugSlowDbHandler(req: Request, res: Response): Promise<void> {
  const requestedMs = Number(req.query.delayMs ?? 1000);
  const safeMs = Number.isFinite(requestedMs) ? requestedMs : 1000;
  const delayMs = Math.min(Math.max(safeMs, 0), MAX_SIMULATED_DELAY_MS);
  const delaySeconds = delayMs / 1000;

  await withSpan(
    "database.slow_query.simulated",
    async () => {
      await prisma.$queryRawUnsafe(`SELECT SLEEP(${delaySeconds})`);
    },
    { "lab.simulated": true, "lab.delay_ms": delayMs }
  );

  res.status(200).json({
    message: "Simulated slow database query completed",
    "lab.simulated": true,
    delayMs,
  });
}
