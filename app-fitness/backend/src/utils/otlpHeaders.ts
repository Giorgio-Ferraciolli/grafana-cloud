/**
 * Parses the standard OTEL_EXPORTER_OTLP_HEADERS env var format
 * ("key1=value1,key2=value2") used to attach auth headers (e.g. Grafana
 * Cloud's Authorization: Basic ...) to outgoing OTLP exports.
 */
export function parseOtlpHeaders(raw?: string): Record<string, string> {
  if (!raw) return {};
  return raw
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, pair) => {
      const idx = pair.indexOf("=");
      if (idx === -1) return acc;
      const key = pair.slice(0, idx).trim();
      const value = pair.slice(idx + 1).trim();
      if (key) acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}
