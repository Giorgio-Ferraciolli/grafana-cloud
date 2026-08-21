import pino from "pino";
import { trace } from "@opentelemetry/api";

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "apikey",
  "api_key",
  "authorization",
  "credential",
  "credentials",
  "secret",
]);

function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        key,
        SENSITIVE_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : redact(val),
      ])
    );
  }
  return value;
}

const serviceName = process.env.OTEL_SERVICE_NAME || "planner-backend";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: undefined,
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level(label) {
      return { level: label };
    },
    log(object) {
      return redact(object) as Record<string, unknown>;
    },
  },
  mixin() {
    const span = trace.getActiveSpan();
    const ctx = span?.spanContext();
    return {
      "service.name": serviceName,
      ...(ctx ? { trace_id: ctx.traceId, span_id: ctx.spanId } : {}),
    };
  },
});

export type Logger = typeof logger;
