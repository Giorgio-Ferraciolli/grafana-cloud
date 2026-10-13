"""Instrumentação do backend.

- Traces:   OpenTelemetry (FastAPI + PyMySQL) -> OTLP/gRPC -> Alloy -> Grafana Cloud Tempo
- Métricas: Prometheus em /metrics (HTTP + negócio) -> scrape do Alloy -> Grafana Cloud Prometheus
- Logs:     JSON no stdout com trace_id/span_id -> Alloy (docker) -> Grafana Cloud Loki

A configuração do exportador OTLP vem das variáveis OTEL_* definidas no docker-compose.yml.
Os logs nunca incluem e-mail ou telefone dos clientes.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

from fastapi import FastAPI, Request
from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.pymysql import PyMySQLInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from prometheus_client import Counter, Histogram, disable_created_metrics
from prometheus_fastapi_instrumentator import Instrumentator

log = logging.getLogger("vw.http")
disable_created_metrics()  # sem séries *_created: economiza séries ativas no Grafana Cloud

# ---------- métricas de negócio ----------

LEADS = Counter("vw_leads_created_total", "Propostas registradas", ["model", "source"])
TEST_DRIVES = Counter("vw_test_drives_created_total", "Test drives agendados", ["model"])
TEST_DRIVE_CONFLICTS = Counter("vw_test_drive_conflicts_total", "Tentativas de agendar horário já ocupado")
VALUATIONS = Counter("vw_valuations_total", "Estimativas de usado calculadas", ["model"])
SELL_REQUESTS = Counter("vw_sell_requests_total", "Pedidos de avaliação de usado gravados", ["model"])
VALUATION_ESTIMATE = Histogram(
    "vw_valuation_estimate_brl",
    "Valor estimado pago pelo usado, em reais",
    buckets=(20_000, 40_000, 60_000, 80_000, 100_000, 150_000, 200_000, 300_000),
)
STATUS_CHANGES = Counter("vw_status_changes_total", "Mudanças de status feitas no painel", ["entity", "status"])


# ---------- logs JSON ----------

class JsonFormatter(logging.Formatter):
    """Uma linha JSON por evento, com trace_id/span_id do span ativo."""

    def format(self, record: logging.LogRecord) -> str:
        data = {
            "ts": datetime.fromtimestamp(record.created, timezone.utc).isoformat(timespec="milliseconds"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "msg": record.getMessage(),
        }
        ctx = trace.get_current_span().get_span_context()
        if ctx.is_valid:
            data["trace_id"] = format(ctx.trace_id, "032x")
            data["span_id"] = format(ctx.span_id, "016x")
        data.update(getattr(record, "fields", {}) or {})
        if record.exc_info:
            data["exception"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False, default=str)


def setup_logging() -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    # o uvicorn configura os próprios handlers antes de importar a app; passamos tudo pelo JSON
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True
    logging.getLogger("uvicorn.access").disabled = True  # o middleware abaixo registra os acessos


# ---------- traces ----------

def setup_tracing() -> None:
    if os.getenv("OTEL_SDK_DISABLED", "").lower() == "true":
        return
    provider = TracerProvider(resource=Resource.create())  # lê OTEL_SERVICE_NAME e OTEL_RESOURCE_ATTRIBUTES
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))  # lê OTEL_EXPORTER_OTLP_ENDPOINT
    trace.set_tracer_provider(provider)
    PyMySQLInstrumentor().instrument()  # um span por query no MySQL


def span_attrs(**attrs) -> None:
    """Adiciona atributos ao span da requisição atual (aparecem no Tempo)."""
    span = trace.get_current_span()
    for key, value in attrs.items():
        if value is not None:
            span.set_attribute(f"vw.{key}", value)


# ---------- ligação com a app ----------

def instrument(app: FastAPI) -> None:
    setup_logging()
    setup_tracing()

    # Métricas HTTP: http_requests_total, http_request_duration_seconds etc.
    Instrumentator(excluded_handlers=["/metrics"]).instrument(app).expose(app, include_in_schema=False)

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("erro não tratado", extra={"fields": {
                "method": request.method, "path": request.url.path, "status": 500,
                "duration_ms": round((time.perf_counter() - start) * 1000, 1),
            }})
            raise
        if request.url.path not in ("/metrics", "/api/health"):
            route = request.scope.get("route")
            status = response.status_code
            level = logging.ERROR if status >= 500 else logging.WARNING if status >= 400 else logging.INFO
            log.log(level, f"{request.method} {request.url.path} {status}", extra={"fields": {
                "method": request.method,
                "path": request.url.path,
                "route": getattr(route, "path", None),
                "status": status,
                "duration_ms": round((time.perf_counter() - start) * 1000, 1),
            }})
        return response

    # Por último, para o span do OpenTelemetry envolver todos os middlewares
    FastAPIInstrumentor.instrument_app(app, excluded_urls="/metrics,/api/health")
