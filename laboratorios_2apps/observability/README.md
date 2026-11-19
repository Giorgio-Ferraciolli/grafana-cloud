# observability — Grafana Alloy do laboratório

Um Alloy em Docker que manda a telemetria das duas APIs e do banco para o Grafana Cloud.

| Sinal                 | Origem                                                    | Destino    |
|-----------------------|-----------------------------------------------------------|------------|
| Logs                  | stdout dos containers (lidos via `docker.sock`)           | Loki       |
| Traces                | OpenTelemetry nas apps → OTLP `:4317` do Alloy (inclui um span por query no banco) | Tempo |
| Métricas das apps     | OpenTelemetry nas apps + probes do `/health`              | Prometheus |
| Métricas do banco     | `prometheus.exporter.postgres` (postgres_exporter embutido no Alloy) | Prometheus |
| Database Observability| `database_observability.postgres`: amostras de queries, planos (EXPLAIN), schema | Loki + Prometheus |
| Profiles              | SDK Pyroscope nas apps → `:4040` do Alloy                 | Pyroscope  |

Só entram os logs dos serviços `flask-lab-api`, `java-lab-api` e `postgres-lab` do compose
`laboratorios` (o `service_name` no Loki é o nome do serviço).
Tudo leva o label/atributo `env=wsl-lab` / `deployment.environment=wsl-lab`.
As métricas do banco saem com `job="integrations/db-o11y"` e `instance="postgres-lab"`.

## Subir

É o serviço `alloy` do [`docker-compose.yml`](../docker-compose.yml) da raiz. Os USER/TOKEN do
Grafana Cloud ficam no `.env` da raiz; o `POSTGRES_DSN` é montado pelo compose com a
`MONITOR_DB_PASSWORD`. Na raiz:

```bash
docker compose up -d --wait alloy   # sobe o banco junto, se precisar
```

UI do Alloy (grafo dos componentes e saúde): http://localhost:12345

O compose sobe o Alloy depois do banco e antes das APIs. Se ele cair, as apps continuam
normais e só perdem telemetria.
Se o banco estiver fora, o Alloy continua no ar e manda `pg_up 0`.

**Mudou o `config.alloy`?** Rode `docker compose restart alloy`. O `curl -X POST
localhost:12345/-/reload` só funciona se o editor gravar no mesmo arquivo: o VS Code e
outros trocam o arquivo por um novo, e o container continua vendo a versão antiga
(o bind mount é de um arquivo só).

## Como as apps foram instrumentadas (sem mudar código)

- **java-lab-api**: o Dockerfile baixa o OpenTelemetry Java agent e o compose o liga com
  `JAVA_TOOL_OPTIONS=-javaagent:...`. Para desligar, remova essa variável.
- **flask-lab-api**: `opentelemetry-distro` no `requirements.txt` e o `CMD` passa por
  `opentelemetry-instrument`. Para desligar, `OTEL_SDK_DISABLED=true` no compose.
- Ambas mandam para `alloy:4317`, pela rede do compose (`OTEL_EXPORTER_OTLP_ENDPOINT`).
  As portas 4317/4318 também ficam publicadas no host, para apps rodando fora do compose.
- `OTEL_LOGS_EXPORTER=none`: logs vão só pelo docker, para não duplicar no Loki.

### Traces do banco

Cada query vira um span `CLIENT` filho do span HTTP, no mesmo trace, com
`db.system=postgresql`, `db.name=lab`, `db.user=lab_app` e `db.statement` (a query com `?`/`%s`
no lugar dos valores).

- **java-lab-api**: o próprio OpenTelemetry Java agent instrumenta o JDBC (span `SELECT lab.items`).
  Também gera as métricas do pool HikariCP (`db_client_connections_*`).
- **flask-lab-api**: `opentelemetry-instrumentation-psycopg` no `requirements.txt`; o
  `opentelemetry-instrument` liga sozinho (span `SELECT`).

### Banco (PostgreSQL)

O Alloy entra no `postgres-lab:5432` como `db-o11y` (usuário só leitura, criado no initdb) com
o `POSTGRES_DSN` montado no compose:

- `prometheus.exporter.postgres`: conexões, transações, cache hit, locks, tamanho, linhas por
  tabela e estatística **por query** (`pg_stat_statements`). Atenção: `enabled_collectors`
  substitui a lista padrão, por isso os padrões estão repetidos no `config.alloy`.
- `database_observability.postgres`: alimenta o app **Database Observability** do Grafana
  Cloud (amostras das queries em execução, detalhes por query, planos de execução e schema).
  Também reexporta as métricas do exporter, por isso só ele é raspado.
- Logs do Postgres (stdout) entram pelo mesmo caminho dos logs das APIs.

### Profiling (Pyroscope)

- **java-lab-api**: o Dockerfile baixa o agente `pyroscope.jar` e o compose o liga com um
  segundo `-javaagent` no `JAVA_TOOL_OPTIONS`. Coleta CPU (`itimer`, porque o evento `cpu`
  precisa de perf_events, bloqueado no Docker), alocação (a cada 512 KB) e locks (> 10 ms).
  Para desligar, tire o `-javaagent:/app/pyroscope.jar`.
- **flask-lab-api**: `pyroscope-io` no `requirements.txt`, ligado no hook `post_fork` do
  `gunicorn.conf.py` (o `app.py` não muda). Coleta só CPU. Para desligar, remova
  `PYROSCOPE_SERVER_ADDRESS` do compose.
- Ambas mandam para `alloy:4040`; o Alloy repassa ao Grafana Cloud.

## Onde olhar no Grafana

Cole as consultas no **Explore**, escolhendo a fonte de dados indicada.

### Logs (Loki)

Todos os logs da API Java:

```logql
{service_name="java-lab-api"}
```

Só os erros da API Flask:

```logql
{service_name="flask-lab-api", level="ERROR"}
```

Logs do Postgres (queries lentas > 200ms, locks, erros, conexões recusadas):

```logql
{service_name="postgres-lab"}
```

Só as queries lentas, e de qual API vieram (`app=...` no começo da linha):

```logql
{service_name="postgres-lab"} |= "duration:"
```

Coletas do Database Observability (amostras de queries, planos, schema):

```logql
{job="integrations/db-o11y", instance="postgres-lab"}
```

### Traces (Tempo)

Traces da API Java (troque por `flask-lab-api` para a outra):

```traceql
{resource.service.name="java-lab-api"}
```

Só requisições com erro ou lentas (> 500ms):

```traceql
{resource.service.name="java-lab-api" && (status = error || duration > 500ms)}
```

Todas as queries no banco, das duas APIs:

```traceql
{span.db.system = "postgresql"}
```

Queries lentas (> 20ms) ou com erro:

```traceql
{span.db.system = "postgresql" && (duration > 20ms || status = error)}
```

Requisições HTTP da Flask que fizeram INSERT (span HTTP com um filho de banco):

```traceql
{resource.service.name="flask-lab-api" && kind = server} > {span.db.statement =~ "INSERT.*"}
```

Abrindo um trace, o span do banco aparece embaixo do span HTTP com a query em `db.statement`.
Com o gerador de métricas do Tempo ligado na stack (Application Observability), a aba
**Service Graph** mostra as duas APIs apontando para o mesmo nó do banco.

### Métricas (Prometheus)

Uptime das duas APIs (1 = no ar, 0 = fora):

```promql
probe_success{job=~"integrations/blackbox/.*"}
```

Latência p95 por rota — Java (segundos):

```promql
histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_request_duration_seconds_bucket{job="java-lab-api"}[5m])))
```

Latência p95 por rota — Flask (milissegundos):

```promql
histogram_quantile(0.95, sum by (le, http_route) (rate(http_server_duration_milliseconds_bucket{job="flask-lab-api"}[5m])))
```

Requisições por segundo, por status HTTP — Java:

```promql
sum by (http_response_status_code) (rate(http_server_request_duration_seconds_count{job="java-lab-api"}[5m]))
```

Requisições por segundo, por status HTTP — Flask:

```promql
sum by (http_status_code) (rate(http_server_duration_milliseconds_count{job="flask-lab-api"}[5m]))
```

Memória usada pela JVM:

```promql
sum by (jvm_memory_type) (jvm_memory_used_bytes{job="java-lab-api"})
```

Tempo gasto em GC pela JVM (segundos por segundo):

```promql
sum(rate(jvm_gc_duration_seconds_sum{job="java-lab-api"}[5m]))
```

#### Banco (PostgreSQL)

Banco no ar (1) ou fora (0):

```promql
pg_up{job="integrations/db-o11y"}
```

Conexões abertas por API e estado (`application_name` = `flask-lab-api` / `java-lab-api`):

```promql
sum by (application_name, state) (pg_stat_activity_count{job="integrations/db-o11y", datname="lab"})
```

Transações por segundo (commits e rollbacks):

```promql
sum(rate(pg_stat_database_xact_commit{job="integrations/db-o11y", datname="lab"}[5m]))
sum(rate(pg_stat_database_xact_rollback{job="integrations/db-o11y", datname="lab"}[5m]))
```

Cache hit (fração das leituras servidas da memória; perto de 1 é o esperado):

```promql
sum(rate(pg_stat_database_blks_hit{job="integrations/db-o11y", datname="lab"}[5m]))
/
(sum(rate(pg_stat_database_blks_hit{job="integrations/db-o11y", datname="lab"}[5m]))
 + sum(rate(pg_stat_database_blks_read{job="integrations/db-o11y", datname="lab"}[5m])))
```

Itens na tabela e tamanho do banco:

```promql
pg_stat_user_tables_n_live_tup{job="integrations/db-o11y", relname="items"}
pg_database_size_bytes{job="integrations/db-o11y", datname="lab"}
```

Top 10 queries das APIs por tempo gasto (segundos por segundo), com o texto da query:

```promql
topk(10,
  sum by (queryid) (rate(pg_stat_statements_seconds_total{job="integrations/db-o11y", user="lab_app"}[5m]))
  * on (queryid) group_left(query)
  max by (queryid, query) (pg_stat_statements_query_id{job="integrations/db-o11y"})
)
```

Latência média de cada query (segundos):

```promql
sum by (queryid) (rate(pg_stat_statements_seconds_total{job="integrations/db-o11y", user="lab_app"}[5m]))
/
sum by (queryid) (rate(pg_stat_statements_calls_total{job="integrations/db-o11y", user="lab_app"}[5m]))
```

Pool de conexões da API Java (HikariCP), por estado `idle`/`used`:

```promql
sum by (state) (db_client_connections_usage{job="java-lab-api"})
```

#### Dashboards prontos

- **Database Observability**: no Grafana Cloud, menu **Observability → Database
  Observability** (se o app estiver disponível na sua stack). Mostra as queries do `lab` com
  latência, chamadas, planos de execução e as tabelas.
- **PostgreSQL**: em **Connections → Add new connection → PostgreSQL**, instale só os
  dashboards (pule a parte de configurar o Alloy: já está feita aqui). Se algum painel vier
  vazio, confira as variáveis `job`/`instance` no topo: os valores daqui são
  `integrations/db-o11y` e `postgres-lab`.

### Profiles (Pyroscope)

No Grafana, abra **Drilldown → Profiles** (ou o Explore com a fonte de dados de profiles) e
escolha `service_name` = `java-lab-api` ou `flask-lab-api`. Tipos de profile:

- Java: `process_cpu` (CPU), `memory` (alocação), `mutex` (locks)
- Flask: `process_cpu` (CPU)

## Conferir se está enviando

```bash
curl -s localhost:12345/metrics | grep -E '^(otelcol_exporter_(sent|send_failed)_spans|prometheus_remote_storage_samples_(total|failed_total)|loki_write_sent_entries_total|pyroscope_write_sent_profiles_total)'
docker logs alloy 2>&1 | grep -E 'level=(error|warn)'
```

Banco: o exporter conecta (`pg_up 1`) e todos os coletores rodam (`... 1`):

```bash
curl -s localhost:12345/api/v0/component/prometheus.exporter.postgres.lab/metrics | grep -E '^(pg_up|pg_scrape_collector_success)'
```

`pg_up 0` = o Alloy não alcança o banco ou a senha do `POSTGRES_DSN` não bate com a
senha com que o volume do banco foi criado (a `MONITOR_DB_PASSWORD` só vale na criação).
