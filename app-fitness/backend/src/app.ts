import express, { Express } from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { apiRouter } from "./routes";
import { otelRouter } from "./routes/otel.routes";
import { requestLogger } from "./middlewares/requestLogger";
import { globalErrorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { openApiSpec } from "./openapi/spec";

export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "traceparent", "tracestate"],
      // The browser OTLP trace exporter issues its POST /v1/traces with
      // credentials included by default; without this, the preflight is
      // rejected and frontend spans never make it to the backend.
      credentials: true,
    })
  );

  app.use(requestLogger);

  // Mounted before the global JSON body parser: this route needs the raw
  // request body to forward it untouched to the OTLP collector.
  app.use(otelRouter);

  app.use(express.json({ limit: "2mb" }));

  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get("/openapi.json", (_req, res) => res.json(openApiSpec));

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(globalErrorHandler);

  return app;
}
