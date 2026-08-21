# Planejador de Rotina

Um planejador de treino e alimentação pessoal, construído para ser **antes de
tudo um laboratório de observabilidade**: cada ação do usuário — sobretudo o
botão "Gerar minha rotina" — foi desenhada para produzir traces distribuídos,
logs correlacionados e métricas reais entre o browser, a API e o banco de
dados, prontos para explorar no Grafana Cloud com OpenTelemetry.

A geração de treino e dieta usa uma lógica **determinística** baseada no
perfil do usuário (sem IA real) — o foco do projeto é a arquitetura e a
observabilidade, não a qualidade nutricional/esportiva do plano gerado.

## Sumário

- [Arquitetura](#arquitetura)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Tecnologias](#tecnologias)
- [Como iniciar o projeto](#como-iniciar-o-projeto)
- [Migrations](#migrations)
- [Seed](#seed)
- [Acessando a aplicação](#acessando-a-aplicação)
- [API e documentação OpenAPI](#api-e-documentação-openapi)
- [Testes](#testes)
- [Observabilidade](#observabilidade)
- [Laboratório: gerando traces, latência e erros](#laboratório-gerando-traces-latência-e-erros)
- [Encontrando traces e correlacionando com logs no Grafana Cloud](#encontrando-traces-e-correlacionando-com-logs-no-grafana-cloud)
- [Subir/descer os containers](#subirdescer-os-containers)

## Arquitetura

```text
Browser (React + OpenTelemetry Web SDK)
   |
   | HTTP/REST (fetch instrumentado, traceparent propagado)
   v
Frontend (nginx servindo o build estático em :3000)
   |
   | (chamadas de API feitas diretamente do browser para o backend)
   v
Backend (Node.js + Express + TypeScript, :3001)
   |  - instrumentado com OpenTelemetry (HTTP, Express, Prisma)
   |  - expõe POST /v1/traces: recebe spans do browser e repassa ao
   |    coletor/Grafana Cloud com as credenciais do servidor
   |
   | Prisma ORM
   v
MySQL 8 (:3306)
```

Todos os três serviços (frontend, backend, mysql) sobem via Docker Compose.
Nenhuma dependência precisa ser instalada na máquina host além de Docker.

## Estrutura de diretórios

```text
app_fitness/
├── backend/
│   ├── src/
│   │   ├── controllers/      # tradução HTTP <-> serviços
│   │   ├── services/         # regras de negócio (geração de plano, etc.)
│   │   ├── routes/           # definição das rotas REST + doc OpenAPI (JSDoc)
│   │   ├── middlewares/      # logger de requisição, validação, erros
│   │   ├── database/         # cliente Prisma
│   │   ├── metrics/          # instrumentos OpenTelemetry customizados
│   │   ├── validation/       # schemas Zod
│   │   ├── utils/            # tracing helper, logger, erros
│   │   ├── instrumentation.ts# bootstrap do OpenTelemetry (Node SDK)
│   │   ├── app.ts            # montagem do Express app
│   │   └── server.ts         # entrypoint
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/               # cliente HTTP tipado
│   │   ├── components/        # ui/, dashboard/, layout/
│   │   ├── pages/              # Onboarding, Dashboard, Workouts, Diet, Lab
│   │   ├── hooks/, context/, lib/, types/
│   │   └── otel.ts             # bootstrap do OpenTelemetry Web SDK
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

## Tecnologias

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query,
React Router, OpenTelemetry Web SDK (fetch/XHR/document-load
instrumentation), servido em produção via nginx.

**Backend:** Node.js, TypeScript, Express, Prisma ORM, Zod (validação), Pino
(logs estruturados), swagger-ui-express + swagger-jsdoc (OpenAPI),
OpenTelemetry SDK for Node (`@opentelemetry/sdk-node`,
auto-instrumentations, `@prisma/instrumentation`).

**Banco:** MySQL 8.

**Infra:** Docker + Docker Compose.

## Como iniciar o projeto

Requisitos: **Docker** e **Docker Compose** — nada além disso.

```bash
cp .env.example .env   # ajuste se quiser, os defaults já funcionam localmente
docker compose up --build
```

Isso builda as três imagens e sobe `mysql` → `backend` → `frontend`, nessa
ordem (via `depends_on` + healthchecks). Na primeira subida o backend
automaticamente:

1. aplica as migrations do Prisma (`prisma migrate deploy`);
2. roda o seed (`prisma db seed`), que é idempotente — pode rodar toda vez
   que o container inicia sem duplicar dados;
3. inicia o servidor HTTP.

Ou seja: **depois de `docker compose up --build`, a aplicação já está pronta
para uso**, com usuários, exercícios, alimentos e um plano de exemplo por
usuário já carregados.

## Migrations

As migrations ficam versionadas em `backend/prisma/migrations/` e são
aplicadas automaticamente pelo container do backend (`prisma migrate
deploy`) toda vez que ele sobe.

Para criar uma nova migration depois de alterar `backend/prisma/schema.prisma`:

```bash
docker compose exec backend npx prisma migrate dev --name descricao_da_mudanca
```

## Seed

O seed roda automaticamente no start do backend. Para executá-lo manualmente
(por exemplo, depois de limpar o banco):

```bash
docker compose exec backend npx prisma db seed
```

O seed cria:

- ~45 exercícios cobrindo todos os grupos musculares;
- ~40 alimentos cobrindo as categorias usadas na geração de dieta, com tags
  para restrições (vegetariano, vegano, sem lactose, sem glúten);
- 3 usuários de exemplo, cada um com preferências distintas e um plano de
  treino + dieta já gerado.

## Acessando a aplicação

| Serviço            | URL                            |
|---------------------|---------------------------------|
| Frontend             | http://localhost:3000          |
| Backend (API)         | http://localhost:3001          |
| Health check          | http://localhost:3001/api/health |
| Documentação Swagger  | http://localhost:3001/docs      |
| OpenAPI JSON          | http://localhost:3001/openapi.json |
| MySQL (opcional, debug)| localhost:3306                |

Abra o frontend, complete o onboarding (perfil + preferências) e clique em
**"Gerar minha rotina"** no Dashboard.

## API e documentação OpenAPI

A documentação interativa (Swagger UI) fica em `/docs`. Os principais
endpoints:

```text
GET    /api/health
POST   /api/users
GET    /api/users/:id
PUT    /api/users/:id/preferences
POST   /api/plans/generate         (?simulateDelay=<ms>, lab feature)
GET    /api/plans/:userId
GET    /api/workouts/:userId
GET    /api/diet/:userId
GET    /api/exercises
GET    /api/foods
GET    /api/debug/error            (lab: erro 500 proposital)
GET    /api/debug/slow-db          (lab: SELECT SLEEP() no MySQL)
```

## Testes

```bash
docker compose exec backend npm test
```

Cobre: health check, criação/consulta de usuário, validação de payload,
geração completa de plano (7 dias de treino + 6 refeições), erro 404 (rota
e recurso inexistentes) e erro 500 (endpoint de laboratório).

## Observabilidade

Esta aplicação foi desenhada para não simplificar a observabilidade. Ela
instrumenta:

- **Traces**: HTTP server, rotas Express, Prisma/MySQL e as etapas de
  negócio reais da geração de plano (nenhum span é criado só para "encher"
  o trace — veja a árvore completa na próxima seção).
- **Logs**: JSON estruturado (Pino) com `timestamp`, `level`, `message`,
  `service.name`, `trace_id`, `span_id`, `http.method`, `http.route`,
  `http.status_code` e `duration_ms`, correlacionáveis com os traces via
  `trace_id`/`span_id`. Nunca loga senhas, tokens, API keys ou headers de
  autenticação (redação automática).
- **Métricas**: contadores/histogramas de requisições HTTP, erros,
  operações de banco, e as métricas de negócio `planner.plans.generated`
  (contador) e `planner.plan.generation.duration` (histograma).

### Configurando o Grafana Cloud

1. No Grafana Cloud, crie uma **Cloud Access Policy** com escopo de escrita
   para `metrics`, `traces` (e `logs`, se for usar) e gere um token.
2. Monte o header de autenticação Basic: `base64("<Instance ID>:<token>")`.
3. No `.env` na raiz do projeto, preencha:

   ```env
   OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf
   OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-<region>.grafana.net/otlp
   OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic%20<base64(instanceID:token)>
   ```

4. Suba (ou reinicie) o backend: `docker compose up -d --build backend`.

`OTEL_EXPORTER_OTLP_PROTOCOL` aceita `http/protobuf` (recomendado pelo
quickstart do Grafana Cloud, e o padrão se a variável não for definida) ou
`http/json`. O SDK JS não lê essa variável nativamente como Python/Java/Go -
o backend escolhe entre os pacotes `exporter-*-otlp-proto` e
`exporter-*-otlp-http` (JSON) com base nela (veja `src/instrumentation.ts`).

Alternativa: se você já tem um coletor local (por exemplo, um Grafana Alloy
rodando no host com um receptor OTLP configurado), aponte
`OTEL_EXPORTER_OTLP_ENDPOINT` para ele em vez do Grafana Cloud diretamente,
por exemplo `http://host.docker.internal:4318` (o `docker-compose.yml` já
mapeia `host.docker.internal` para o host no serviço `backend`).

Se `OTEL_EXPORTER_OTLP_ENDPOINT` ficar em branco, o backend não quebra: ele
imprime spans e métricas no console (`ConsoleSpanExporter`/
`ConsoleMetricExporter`) e avisa isso no log, então dá para desenvolver sem
Grafana Cloud configurado. Falhas reais de exportação (credenciais erradas,
endpoint incorreto) são logadas via `diag.setLogger` em nível `ERROR` - se
os traces não aparecerem no Grafana Cloud, confira os logs do backend
primeiro (`docker compose logs backend`).

### Como o frontend exporta traces sem expor credenciais

O React app **não fala diretamente com o Grafana Cloud**. Ele exporta spans
via OTLP/HTTP para uma rota própria do backend (`POST /v1/traces`, no mesmo
domínio, sem CORS); o backend repassa esse payload para
`OTEL_EXPORTER_OTLP_ENDPOINT`, anexando `OTEL_EXPORTER_OTLP_HEADERS`
server-side. Nenhuma credencial do coletor chega ao bundle do browser.

### `service.name`

- Backend: `planner-backend` (via `OTEL_SERVICE_NAME`)
- Frontend: `planner-frontend` (definido em `frontend/src/otel.ts`)

No Grafana Cloud, filtre por esses nomes de serviço para separar os dois
lados do trace.

## Laboratório: gerando traces, latência e erros

A página **Laboratório** no frontend (`/lab`) tem botões prontos para cada
cenário abaixo. Todos também podem ser chamados diretamente via `curl`.

### Trace simples

```bash
curl -X POST http://localhost:3001/api/plans/generate \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid-de-um-usuário>"}'
```

Produz uma árvore de spans como:

```text
HTTP POST /api/plans/generate
  business.generate_plan
    business.validate_user
    database.load_user
    database.load_preferences
    business.generate_workout_plan
      database.load_exercises   (uma vez por dia de treino)
    business.generate_diet_plan
      database.load_foods       (uma vez por refeição)
    database.save_workout_plan
    database.save_diet_plan
```

### Trace complexo (com latência)

```bash
curl -X POST "http://localhost:3001/api/plans/generate?simulateDelay=1500" \
  -H "Content-Type: application/json" \
  -d '{"userId":"<uuid-de-um-usuário>"}'
```

Adiciona um span `lab.simulate_delay` (marcado com o atributo
`lab.simulated=true`) de até 10000ms dentro da mesma árvore acima — ótimo
para comparar visualmente um span lento no meio de um trace normal.

### Erro controlado

```bash
curl http://localhost:3001/api/debug/error
```

Retorna 500 propositalmente. No trace, o span correspondente é marcado como
erro (`exception` event + `status: ERROR`); no log, sai um registro `error`
com o mesmo `trace_id`.

### Banco lento

```bash
curl "http://localhost:3001/api/debug/slow-db?delayMs=2000"
```

Executa um `SELECT SLEEP()` real no MySQL dentro de um span
`database.slow_query.simulated`. O delay é limitado a 5000ms no servidor
para não travar o pool de conexões.

## Encontrando traces e correlacionando com logs no Grafana Cloud

1. Em **Explore**, escolha a fonte de dados de traces (Tempo) do seu stack.
2. Filtre por `service.name = planner-backend` (ou `planner-frontend`).
3. Abra um trace do `POST /api/plans/generate` e explore a árvore de spans
   descrita acima.
4. A partir de um span, use o botão **"Logs for this span"**
   (ou pesquise em Loki por `trace_id="<id do span>"`) para ver os logs
   estruturados daquela requisição — eles carregam o mesmo `trace_id` e
   `span_id` gerados pelo backend, então a correlação é direta.
5. Para latência/erros agregados, vá em **Metrics** e busque por
   `http_server_duration`, `http_server_errors`, `planner_plans_generated`
   ou `planner_plan_generation_duration`.

## Subir/descer os containers

```bash
# subir (rebuild se algo mudou)
docker compose up --build

# subir em background
docker compose up -d --build

# ver logs
docker compose logs -f backend

# parar (mantém os dados do MySQL no volume)
docker compose stop

# derrubar e remover os containers (mantém o volume mysql_data)
docker compose down

# derrubar e apagar também os dados do MySQL
docker compose down -v
```
