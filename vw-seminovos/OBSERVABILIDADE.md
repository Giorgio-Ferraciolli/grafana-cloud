# Observabilidade: Grafana Alloy + Grafana Cloud

Guia da instrumentação do VW Seminovos. Métricas, logs e traces de todo o projeto
(navegador, nginx, API, MySQL e containers) são coletados pelo **Grafana Alloy** e enviados ao
**Grafana Cloud** (Prometheus/Mimir, Loki e Tempo).

## Arquitetura

```
 Navegador ── Faro SDK ──► nginx /collect ──┐
     │ (traceparent)                         │
     ▼                                       ▼
 nginx (frontend) ──► FastAPI (backend) ──OTLP gRPC──►  ┌──────────── Alloy ────────────┐
     │ logs JSON          │ logs JSON + /metrics        │ faro.receiver                 │──► Tempo   (traces)
     │                    │                             │ otelcol.receiver.otlp         │
     │                    ▼                             │ loki.source.docker            │──► Loki    (logs)
     │                 MySQL ◄── exporter MySQL ────────│ prometheus.scrape (backend,   │
     │                                                  │   MySQL, cAdvisor, Alloy)     │──► Prometheus (métricas)
     └── stdout/stderr de todos os containers ─────────►└───────────────────────────────┘
```

| Sinal    | Origem                                          | Como chega ao Alloy                   | Destino        |
|----------|-------------------------------------------------|---------------------------------------|----------------|
| Traces   | API FastAPI e queries no MySQL (OpenTelemetry)  | OTLP gRPC em `alloy:4317`             | Tempo          |
| Traces   | Navegador: carregamento e chamadas `fetch` (Faro) | `POST /collect` via nginx           | Tempo          |
| Métricas | API: HTTP (RED) e métricas de negócio           | Scrape de `backend:8000/metrics`      | Prometheus     |
| Métricas | MySQL                                           | Exporter embutido no Alloy            | Prometheus     |
| Métricas | CPU, memória, rede e disco dos containers       | cAdvisor embutido no Alloy            | Prometheus     |
| Métricas | Saúde do próprio Alloy                          | `prometheus.exporter.self`            | Prometheus     |
| Logs     | stdout/stderr de todos os containers do projeto | Socket do Docker                      | Loki           |
| Logs     | Navegador: erros, console, Web Vitals e eventos (Faro) | `POST /collect` via nginx      | Loki           |

O trace é contínuo do clique no navegador até a query no MySQL. O Faro envia o cabeçalho
`traceparent`, o nginx repassa e o FastAPI continua o mesmo trace. Os logs do backend levam
o mesmo `trace_id`.

---

## Passo a passo do que foi feito

### 1. Credenciais no `.env`

As credenciais de escrita do stack ficam em `.env`, na raiz do projeto. O Alloy lê esse arquivo via `env_file`.

| Variável                       | Uso                                                           |
|--------------------------------|---------------------------------------------------------------|
| `GRAFANA_PROMETHEUS_URL/USER/TOKEN` | `prometheus.remote_write`                                |
| `GRAFANA_LOKI_URL/USER/TOKEN`  | `loki.write`                                                  |
| `GRAFANA_TEMPO_OTLP_ENDPOINT`  | Exportador OTLP. É o host do Tempo com a porta `:443`.        |
| `GRAFANA_TEMPO_USER/TOKEN`     | Autenticação básica do exportador OTLP                        |
| `GRAFANA_TEMPO_URL`            | Só referência; é a URL de consulta do stack                   |
| `DEPLOY_ENV`                   | Rótulo `environment` em métricas e logs (padrão `lab`)        |
| `MYSQL_EXPORTER_DSN`           | Conexão do exporter de MySQL                                  |

A URL do Tempo informada pelo Grafana Cloud termina em `/tempo`. O envio via OTLP/gRPC usa só
o host, na porta 443. Por exemplo, `https://tempo-prod-17-prod-sa-east-1.grafana.net/tempo` vira
`tempo-prod-17-prod-sa-east-1.grafana.net:443`.

Arquivos de apoio:

- **`.env.example`** é o modelo com placeholders, para outra pessoa configurar o próprio stack.
- **`.gitignore`** contém `.env`, para os tokens nunca irem para o repositório.

Para trocar de stack, edite o `.env` e rode `docker compose up -d alloy`.

### 2. Serviço `alloy` no `docker-compose.yml`

O compose existente ganhou o serviço `alloy` e o volume `alloy_data`:

- **Imagem** `grafana/alloy:v1.19.2`, com versão fixa.
- **Configuração** em `./alloy/config.alloy`, montada como somente leitura.
- **Socket do Docker** montado em `/var/run/docker.sock`. Serve para descobrir os containers e ler os logs.
- **Montagens do cAdvisor:** `/`, `/sys`, `/var/lib/docker` e `/run/containerd`. Por isso o container roda com `privileged: true`.
- **Porta 12345** com a UI de depuração do Alloy. As portas OTLP (4317 e 4318) e do Faro (12347) ficam só na rede interna.

O backend recebeu as variáveis do OpenTelemetry:

```yaml
OTEL_SERVICE_NAME: vw-backend
OTEL_RESOURCE_ATTRIBUTES: service.namespace=vw-seminovos,service.version=2.0.0,deployment.environment.name=lab
OTEL_EXPORTER_OTLP_ENDPOINT: http://alloy:4317
OTEL_EXPORTER_OTLP_PROTOCOL: grpc
OTEL_TRACES_SAMPLER: parentbased_always_on
```

O banco recebeu a montagem de `db/03_monitoring.sql`, descrita no passo 5.

> **Docker Desktop:** com o "containerd image store" ativo, o cAdvisor precisa do socket em
> `/run/containerd`. Sem essa montagem, ele só reporta a série raiz e registra o erro
> `cannot unix dial containerd api service`. Em Linux sem Docker Desktop, a montagem é inofensiva.

### 3. Configuração do Alloy (`alloy/config.alloy`)

| Bloco | O que faz |
|-------|-----------|
| `prometheus.remote_write "grafana_cloud"` | Envia métricas com os rótulos externos `project` e `environment` |
| `loki.write "grafana_cloud"` | Envia logs com os mesmos rótulos externos |
| `otelcol.auth.basic` + `otelcol.exporter.otlp "tempo"` | Envia traces ao Tempo via OTLP/gRPC com autenticação básica |
| `otelcol.receiver.otlp` → `otelcol.processor.batch` | Recebe OTLP do backend e agrupa em lotes. Métricas e logs OTLP também são aceitos e convertidos |
| `faro.receiver "frontend"` + `loki.process "faro"` | Recebe a telemetria do navegador e aplica os rótulos `service_name="vw-web"` e `kind` |
| `discovery.docker` + `loki.source.docker` | Lê os logs só dos containers com o rótulo `com.docker.compose.project=vw-seminovos` |
| `loki.process "containers"` | Processa os logs, descrito abaixo |
| `prometheus.scrape "backend"` | Coleta `backend:8000/metrics` a cada 15 s com `job="vw-backend"` |
| `prometheus.exporter.mysql` | Coleta métricas do MySQL a cada 30 s com `job="integrations/mysql"` |
| `prometheus.exporter.cadvisor` + `prometheus.relabel "cadvisor"` | Coleta métricas dos containers a cada 30 s com `job="integrations/docker"` |
| `prometheus.exporter.self` + `prometheus.relabel "alloy"` | Coleta só as métricas de envio e saúde do próprio Alloy |

O bloco `loki.process "containers"` trata cada serviço de um jeito:

- **Backend:** lê o JSON, cria o rótulo `level` e guarda `trace_id` e `span_id` como *structured metadata*.
- **Nginx:** deriva `level` do status HTTP. 5xx vira `error`, 4xx vira `warning` e o resto vira `info`.
- **MySQL:** extrai o nível de linhas como `[Warning]`.

O relabel do cAdvisor mantém só os containers deste projeto e as métricas usadas nos painéis.
Ele também aplica o rótulo `service_name` com o mesmo padrão dos logs.

Convenção de rótulos: `service_name` é `vw-<serviço do compose>` em logs e métricas de container.
Os valores são `vw-backend`, `vw-frontend`, `vw-db` e `vw-alloy`, e o navegador é `vw-web`.
O `service.name` do OpenTelemetry no backend também é `vw-backend`, o que permite cruzar trace e log.

### 4. Backend (FastAPI)

Arquivos alterados: `backend/telemetry.py` é novo, e mudaram `backend/main.py`,
`backend/requirements.txt` e `backend/Dockerfile`.

**Traces (OpenTelemetry)**

- `FastAPIInstrumentor` cria um span por requisição. Ignora `/metrics` e `/api/health`.
- `PyMySQLInstrumentor` cria um span por query, do tipo *client*, com o texto do SQL.
- `BatchSpanProcessor` com `OTLPSpanExporter` envia via gRPC para `alloy:4317`.
- Os spans recebem atributos de negócio com prefixo `vw.`, como `vw.car_model`, `vw.lead_id`, `vw.lead_source` e `vw.valuation_estimate`.

**Métricas (Prometheus, em `/metrics`)**

- **HTTP:** `prometheus-fastapi-instrumentator` gera `http_requests_total{handler,method,status}` e `http_request_duration_seconds_bucket{handler,method,le}`, entre outras.
- **Negócio:** contadores e um histograma descritos na tabela abaixo.
- **Séries `*_created` desligadas** com `disable_created_metrics()`, para economizar séries ativas.

| Métrica | Tipo | Rótulos |
|---------|------|---------|
| `vw_leads_created_total` | counter | `model`, `source` (`site` ou `simulador`) |
| `vw_test_drives_created_total` | counter | `model` |
| `vw_test_drive_conflicts_total` | counter | nenhum |
| `vw_valuations_total` | counter | `model` |
| `vw_sell_requests_total` | counter | `model` |
| `vw_valuation_estimate_brl` | histogram | nenhum |
| `vw_status_changes_total` | counter | `entity`, `status` |

**Logs (JSON no stdout)**

- O formatter JSON grava uma linha por evento com `ts`, `level`, `logger`, `msg`, `trace_id` e `span_id`, mais campos extras.
- Um middleware registra cada acesso com método, rota, status e `duration_ms`. O uvicorn roda com `--no-access-log` para não duplicar o registro.
- Os eventos de negócio usam o logger `vw.api`, por exemplo "proposta registrada" e "test drive agendado".
- **Nenhum log contém nome, e-mail ou telefone de cliente.** Só aparecem ids e modelos.

**Dependências fixadas**

```
opentelemetry-sdk==1.44.0
opentelemetry-exporter-otlp-proto-grpc==1.44.0
opentelemetry-instrumentation-fastapi==0.65b0
opentelemetry-instrumentation-pymysql==0.65b0
prometheus-fastapi-instrumentator==7.1.0
prometheus-client==0.21.1
```

O instrumentator ficou na versão 7.1.0 porque a 8.x exige Starlette 1.0. Essa versão do
Starlette é incompatível com o FastAPI 0.115 do projeto.

Para desligar os traces sem rebuild, adicione `OTEL_SDK_DISABLED: "true"` no serviço `backend`.

### 5. MySQL: usuário de monitoramento

`db/03_monitoring.sql` cria o usuário `exporter`. Ele tem só os privilégios `PROCESS` e
`REPLICATION CLIENT`, mais `SELECT` em `performance_schema`, e não lê as tabelas da aplicação.
O script roda sozinho em bancos novos. Num volume existente, aplique uma vez:

```powershell
docker cp db\03_monitoring.sql vw-db:/tmp/03_monitoring.sql
docker exec vw-db sh -c "mysql -uroot -proot123 < /tmp/03_monitoring.sql"
```

A senha (`exporter_pass`) precisa ser igual no SQL e no `MYSQL_EXPORTER_DSN` do `.env`.

### 6. Nginx

Mudanças em `frontend/nginx.conf`:

- **Log de acesso em JSON** com `status`, `request_time`, `upstream_time`, `user_agent` e `traceparent`.
- **`location = /collect`** encaminha a telemetria do Faro para `alloy:12347`. O navegador fala só com a própria origem, então não há problema de CORS nem porta extra exposta.
- **`resolver 127.0.0.11`** com o upstream em variável: o nginx resolve `alloy` sob demanda. Assim o site sobe mesmo com o Alloy parado.

### 7. Frontend: Grafana Faro

- **SDK via CDN:** `index.html` carrega `@grafana/faro-web-sdk@2.12.1` e `@grafana/faro-web-tracing@2.12.1` pelo jsDelivr.
- **`frontend/faro.js`** inicializa o Faro com `app.name = "vw-web"`, rastreamento de sessão, captura de console e `TracingInstrumentation`. Os dados vão para `/collect`.
- **`frontend/app.js`** envia a tela atual com `setView` e eventos de negócio sem dados pessoais: `car_viewed`, `lead_sent`, `test_drive_booked`, `simulation_sent`, `valuation_calculated`, `sell_request_sent` e `favorite_toggled`.
- **Bloqueio da CDN:** se um adblock bloquear a CDN, o site funciona normalmente e só não envia telemetria.

> O Faro vai direto para Loki e Tempo pelo Alloy. O app "Frontend Observability" do Grafana Cloud
> exige um coletor próprio e não lista esses dados. Consulte pelo Explore ou pelo dashboard.

### 8. Dashboard

`grafana/dashboard-vw-seminovos.json` traz requisições por segundo, latência p95, taxa de 5xx,
propostas, test drives, avaliações e propostas por modelo. Também mostra CPU e memória por
container, MySQL, envio do Alloy e logs de erro e de negócio.

Para importar, siga Grafana Cloud > Dashboards > New > Import > Upload JSON. Escolha as fontes
`grafanacloud-<stack>-prom` e `grafanacloud-<stack>-logs` nos seletores do topo.

---

## Como subir e validar

```powershell
docker compose up -d --build
docker compose ps                               # vw-alloy precisa estar "Up"
docker logs vw-alloy --since 5m | Select-String "level=error"   # não deve retornar nada
```

1. **Saúde dos componentes:** acesse http://localhost:12345. Os 25 componentes devem aparecer como *healthy*.
2. **Gere tráfego:** navegue pelo site, envie uma proposta e agende um test drive.
3. **Confira os contadores de envio do Alloy:**

```powershell
(Invoke-WebRequest http://localhost:12345/metrics -UseBasicParsing).Content -split "`n" |
  Select-String '^(prometheus_remote_storage_samples_(total|failed_total)|loki_write_(sent|dropped)_entries_total|otelcol_exporter_(sent|send_failed)_spans_total)'
```

Os contadores `*_total` de envio devem crescer. Os de falha e descarte devem ficar em zero.

Resultado da validação feita na implantação:

| Verificação | Resultado |
|-------------|-----------|
| Amostras de métricas enviadas | 2.874, com 0 falhas |
| Linhas de log enviadas | 228, com Loki respondendo 204 e 0 descartes |
| Spans enviados ao Tempo | 112, com 0 falhas |
| Componentes do Alloy | 25 de 25 *healthy* |
| Séries ativas | 1.318, cerca de 13% do limite do plano gratuito |
| Trace contínuo | O `trace_id` do navegador é o mesmo no nginx e nos logs do backend |

## Onde ver os dados no Grafana Cloud

Use o **Explore** ou o **Drilldown** (Metrics, Logs e Traces).

**Métricas (Prometheus)**

```promql
sum by (handler) (rate(http_requests_total{job="vw-backend"}[5m]))
histogram_quantile(0.95, sum by (le, handler) (rate(http_request_duration_seconds_bucket{job="vw-backend"}[5m])))
sum by (model) (increase(vw_leads_created_total[24h]))
sum by (name) (container_memory_working_set_bytes{job="integrations/docker"})
mysql_global_status_threads_connected{instance="vw-db"}
```

**Logs (Loki)**

```logql
{project="vw-seminovos"}                                   # tudo
{service_name="vw-backend"} | json | status >= 400         # erros da API
{service_name="vw-backend"} | trace_id="<id do trace>"     # logs de um trace
{service_name="vw-frontend"} | json | request_time > 0.5   # requisições lentas no nginx
{service_name="vw-web", kind="exception"}                  # erros JavaScript no navegador
{service_name="vw-web", kind="event"}                      # eventos de negócio do navegador
```

**Traces (Tempo, TraceQL)**

```traceql
{ resource.service.name = "vw-backend" }
{ resource.service.name = "vw-backend" && span.vw.car_model = "Golf" }
{ resource.service.name = "vw-backend" && duration > 200ms }
{ resource.service.name = "vw-backend" && kind = client }    # queries no MySQL
```

### Ligar trace e log (opcional)

- **Do trace para o log:** em Connections > Data sources > Tempo > *Trace to logs*, escolha a fonte Loki. Mapeie a tag `service.name` para `service_name` e marque *Filter by trace ID*.
- **Do log para o trace:** em Data sources > Loki > *Derived fields*, adicione o campo `trace_id`. Use o tipo *Label*, porque ele é structured metadata, com link interno para o Tempo e a consulta `${__value.raw}`.

## Solução de problemas

| Sintoma | Causa provável e correção |
|---------|---------------------------|
| `401` ou `invalid token` nos logs do Alloy | Token ou usuário errado no `.env`. Cada sinal tem seu usuário. Depois de corrigir, rode `docker compose up -d alloy` |
| Nenhum trace no Tempo | Confira `GRAFANA_TEMPO_OTLP_ENDPOINT`, que deve ser só o host com `:443`, sem `https://` nem `/tempo` |
| cAdvisor sem containers | No Docker Desktop, confira a montagem de `/run/containerd` (passo 2) |
| `prometheus.exporter.mysql` *unhealthy* | O usuário `exporter` não existe. Aplique o `03_monitoring.sql` (passo 5) |
| Nada do navegador | Um adblock pode bloquear o jsDelivr. Teste em janela anônima e confira se `POST /collect` responde 202 no DevTools |
| Site fora do ar com o Alloy parado | Não deveria acontecer, porque o nginx resolve o Alloy sob demanda. Confira o `resolver` no `nginx.conf` |
| Limite de séries ativas | Reduza o scrape do MySQL ou restrinja mais o `prometheus.relabel` do cAdvisor. O consumo atual fica perto de 1,3 mil séries |

## Segurança

- **`.env` fora do repositório.** Os tokens usados aqui têm só permissão de escrita. Se o `.env` vazar, revogue os tokens em Grafana Cloud > Access Policies e gere novos.
- **UI do Alloy sem autenticação.** A porta 12345 não deve ser exposta fora da máquina.
- **Painel da loja sem login.** O `#/painel` continua sendo só para laboratório.
- **Sem dados pessoais na telemetria.** Logs, atributos de span e eventos do Faro levam só ids, modelos e valores.

## Arquivos criados e alterados

| Arquivo | Mudança |
|---------|---------|
| `.env`, `.env.example`, `.gitignore` | Novos. Credenciais, modelo e exclusão do Git |
| `alloy/config.alloy` | Novo. Pipeline completo do Alloy |
| `docker-compose.yml` | Serviço `alloy`, variáveis `OTEL_*` no backend e script de monitoramento no banco |
| `backend/telemetry.py` | Novo. Traces, métricas, logs JSON e middleware de acesso |
| `backend/main.py` | Chama `telemetry.instrument(app)` e registra métricas, logs e atributos de negócio |
| `backend/requirements.txt`, `backend/Dockerfile` | Dependências de observabilidade e `--no-access-log` |
| `db/03_monitoring.sql` | Novo. Usuário `exporter` do MySQL |
| `frontend/nginx.conf` | Log JSON, proxy `/collect` e resolver do Docker |
| `frontend/faro.js`, `frontend/index.html`, `frontend/Dockerfile` | Faro no navegador |
| `frontend/app.js` | Eventos de negócio e tela atual no Faro |
| `grafana/dashboard-vw-seminovos.json` | Novo. Dashboard para importar |
