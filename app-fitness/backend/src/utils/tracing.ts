import { SpanStatusCode, trace } from "@opentelemetry/api";

const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME || "planner-backend");

/**
 * Runs `fn` inside a child span named after a real unit of work (a
 * validation step, a plan-generation phase, a business rule) so traces
 * reflect what the application actually does instead of being padded with
 * spans that exist only to look busy.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: ReturnType<typeof tracer.startSpan>) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
