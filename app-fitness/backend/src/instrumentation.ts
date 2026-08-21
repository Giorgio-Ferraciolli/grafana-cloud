/**
 * OpenTelemetry bootstrap. This file MUST be the first thing imported by
 * server.ts so that auto-instrumentations can monkey-patch http/express/
 * mysql before those modules are required anywhere else in the process.
 */
import { NodeSDK } from "@opentelemetry/sdk-node";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter as OTLPTraceExporterHttp } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPTraceExporter as OTLPTraceExporterProto } from "@opentelemetry/exporter-trace-otlp-proto";
import { OTLPMetricExporter as OTLPMetricExporterHttp } from "@opentelemetry/exporter-metrics-otlp-http";
import { OTLPMetricExporter as OTLPMetricExporterProto } from "@opentelemetry/exporter-metrics-otlp-proto";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-node";
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";
import { PrismaInstrumentation } from "@prisma/instrumentation";

function parseResourceAttributes(raw?: string): Record<string, string> {
  if (!raw) return {};
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const [key, ...rest] = pair.split("=");
      if (key && rest.length) acc[key.trim()] = rest.join("=").trim();
      return acc;
    }, {});
}

// Otherwise a failed OTLP export (bad credentials, unreachable endpoint,
// wrong wire format) fails completely silently - the app looks fine, it
// just quietly never sends anything.
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

const serviceName = process.env.OTEL_SERVICE_NAME || "planner-backend";
const serviceVersion = process.env.OTEL_SERVICE_VERSION || "1.0.0";
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
// The JS SDK has a separate npm package per wire format instead of reading
// this env var itself (unlike the Python/Java/Go SDKs), so we pick the
// exporter class based on it manually. Grafana Cloud's quickstart defaults
// to "http/protobuf"; "http/json" (the OTLPTraceExporterHttp default) also
// works against its OTLP gateway.
const otlpProtocol = process.env.OTEL_EXPORTER_OTLP_PROTOCOL || "http/protobuf";
const useProtobuf = otlpProtocol === "http/protobuf";

const resource = new Resource({
  [ATTR_SERVICE_NAME]: serviceName,
  [ATTR_SERVICE_VERSION]: serviceVersion,
  ...parseResourceAttributes(process.env.OTEL_RESOURCE_ATTRIBUTES),
});

// Falls back to logging to the console when no collector endpoint has been
// configured yet, so local development never crashes or spams failed HTTP
// export attempts before Grafana Cloud credentials are set up.
let traceExporter;
let metricExporter;
if (!otlpEndpoint) {
  traceExporter = new ConsoleSpanExporter();
  metricExporter = new ConsoleMetricExporter();
} else if (useProtobuf) {
  traceExporter = new OTLPTraceExporterProto();
  metricExporter = new OTLPMetricExporterProto();
} else {
  traceExporter = new OTLPTraceExporterHttp();
  metricExporter = new OTLPMetricExporterHttp();
}

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 15000,
});

export const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
    new PrismaInstrumentation(),
  ],
});

sdk.start();

if (!otlpEndpoint) {
  // eslint-disable-next-line no-console
  console.warn(
    "[otel] OTEL_EXPORTER_OTLP_ENDPOINT is not set - traces and metrics are being printed to the console instead of exported to Grafana Cloud."
  );
}

process.on("SIGTERM", () => {
  sdk
    .shutdown()
    .catch((err) => console.error("[otel] error shutting down SDK", err))
    .finally(() => process.exit(0));
});
