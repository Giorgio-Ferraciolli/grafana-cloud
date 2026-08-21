import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter(process.env.OTEL_SERVICE_NAME || "planner-backend");

export const httpRequestsTotal = meter.createCounter("http.server.requests", {
  description: "Total number of HTTP requests received",
});

export const httpRequestDuration = meter.createHistogram("http.server.duration", {
  description: "Duration of HTTP requests in milliseconds",
  unit: "ms",
});

export const httpErrorsTotal = meter.createCounter("http.server.errors", {
  description: "Total number of HTTP requests that resulted in a 4xx/5xx response",
});

export const dbOperationDuration = meter.createHistogram("db.client.operation.duration", {
  description: "Duration of database operations in milliseconds",
  unit: "ms",
});

export const plansGeneratedTotal = meter.createCounter("planner.plans.generated", {
  description: "Number of workout+diet plans generated",
});

export const planGenerationDuration = meter.createHistogram("planner.plan.generation.duration", {
  description: "Time taken to generate a full plan (workout + diet) in milliseconds",
  unit: "ms",
});
