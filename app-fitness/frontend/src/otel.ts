/**
 * Browser-side OpenTelemetry bootstrap. Imported once at the very top of
 * main.tsx so every fetch call, XHR and the initial document load are
 * captured as spans and stitched into the same trace as the backend.
 *
 * Spans are exported to this app's own backend (`${API_URL}/v1/traces`)
 * rather than straight to a collector: the backend forwards them
 * server-side to OTEL_EXPORTER_OTLP_ENDPOINT with OTEL_EXPORTER_OTLP_HEADERS
 * attached, so no collector credentials ever ship to the browser.
 */
import { WebTracerProvider, BatchSpanProcessor } from "@opentelemetry/sdk-trace-web";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { XMLHttpRequestInstrumentation } from "@opentelemetry/instrumentation-xml-http-request";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { CompositePropagator, W3CBaggagePropagator, W3CTraceContextPropagator } from "@opentelemetry/core";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";
const tracesEndpoint = `${apiUrl.replace(/\/$/, "")}/v1/traces`;

const provider = new WebTracerProvider({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: import.meta.env.VITE_OTEL_SERVICE_NAME || "planner-frontend",
    [ATTR_SERVICE_VERSION]: import.meta.env.VITE_OTEL_SERVICE_VERSION || "1.0.0",
    "deployment.environment": import.meta.env.MODE,
  }),
});

provider.addSpanProcessor(new BatchSpanProcessor(new OTLPTraceExporter({ url: tracesEndpoint })));

provider.register({
  contextManager: new ZoneContextManager(),
  propagator: new CompositePropagator({
    propagators: [new W3CTraceContextPropagator(), new W3CBaggagePropagator()],
  }),
});

registerInstrumentations({
  instrumentations: [
    new DocumentLoadInstrumentation(),
    new FetchInstrumentation({
      // Attach traceparent/tracestate only to our own API so the backend
      // continues the same trace, not to third-party requests (fonts, etc.)
      propagateTraceHeaderCorsUrls: [new RegExp(`^${apiUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)],
      // The exporter itself POSTs to /v1/traces - never instrument that call,
      // or every export would generate a new span that needs exporting.
      ignoreUrls: [/\/v1\/traces$/],
      clearTimingResources: true,
    }),
    new XMLHttpRequestInstrumentation({
      propagateTraceHeaderCorsUrls: [new RegExp(`^${apiUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)],
      ignoreUrls: [/\/v1\/traces$/],
    }),
  ],
});

export { provider as tracerProvider };
