import { Request, Response } from "express";
import { checkDatabaseConnection } from "../database/prismaClient";
import { withSpan } from "../utils/tracing";

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const isConnected = await withSpan("database.health_check", () => checkDatabaseConnection());

  res.status(isConnected ? 200 : 503).json({
    status: isConnected ? "ok" : "degraded",
    database: isConnected ? "connected" : "unavailable",
    "service.name": process.env.OTEL_SERVICE_NAME || "planner-backend",
    "service.version": process.env.OTEL_SERVICE_VERSION || "1.0.0",
    timestamp: new Date().toISOString(),
  });
}
