import type { Agento11yClient as Agento11yClientType } from "@grafana/agento11y";

/**
 * @grafana/agento11y ships ESM-only (its package.json "exports" has no
 * "require" condition), while this app compiles to CommonJS - a static
 * `import` would throw ERR_PACKAGE_PATH_NOT_EXPORTED at startup. Load it via
 * dynamic import() instead, which always uses Node's ESM resolver, and cache
 * the client. Traces/metrics reuse the global TracerProvider/MeterProvider
 * that ../instrumentation registers via NodeSDK.
 */
let clientPromise: Promise<Agento11yClientType> | undefined;

export function getAgento11yClient(): Promise<Agento11yClientType> {
  clientPromise ??= import("@grafana/agento11y").then(({ Agento11yClient }) => new Agento11yClient());
  return clientPromise;
}

export async function shutdownAgento11y(): Promise<void> {
  if (!clientPromise) return;
  const client = await clientPromise;
  await client.shutdown();
}
