import { Router } from "express";
import express from "express";
import { logger } from "../utils/logger";
import { parseOtlpHeaders } from "../utils/otlpHeaders";

/**
 * Secure bridge for browser -> collector trace export.
 *
 * The React app never talks to Grafana Cloud (or any collector) directly:
 * it exports OTLP/JSON spans to this same-origin backend route, which then
 * forwards them server-side to OTEL_EXPORTER_OTLP_ENDPOINT with
 * OTEL_EXPORTER_OTLP_HEADERS attached. This keeps any collector credentials
 * out of the browser bundle entirely and sidesteps CORS on the collector.
 */
export const otelRouter = Router();

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const otlpHeaders = parseOtlpHeaders(process.env.OTEL_EXPORTER_OTLP_HEADERS);

otelRouter.post("/v1/traces", express.raw({ type: "*/*", limit: "5mb" }), async (req, res) => {
  if (!otlpEndpoint) {
    // No collector configured yet: accept and drop so the browser SDK
    // doesn't surface export errors while Grafana Cloud isn't wired up.
    res.status(202).end();
    return;
  }

  try {
    const target = `${otlpEndpoint.replace(/\/$/, "")}/v1/traces`;
    const upstream = await fetch(target, {
      method: "POST",
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        ...otlpHeaders,
      },
      body: req.body,
    });

    res.status(upstream.status).end();
  } catch (err) {
    logger.warn({ err }, "failed to forward browser trace export to collector");
    // Never fail the browser's request over telemetry plumbing issues.
    res.status(202).end();
  }
});
