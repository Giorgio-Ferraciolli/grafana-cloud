# grafana-o11y

Projeto simples em **FastAPI** com frontend HTML/CSS, banco de dados **PostgreSQL** e instrumentação com **OpenTelemetry** para envio de dados ao **Grafana Cloud**.

## Tecnologias

- Python
- FastAPI
- PostgreSQL
- Docker
- Docker Compose
- OpenTelemetry Collector
- Grafana Cloud

## Estrutura do projeto

```text
grafana-o11y/
├── app/
│   ├── routes/
│   │   ├── health.py
│   │   ├── pages.py
│   │   └── pessoas.py
│   ├── static/
│   │   ├── favicon.svg
│   │   └── style.css
│   ├── templates/
│   │   ├── index.html
│   │   └── pessoas.html
│   ├── database.py
│   ├── main.py
│   └── models.py
├── docker-compose.yml
├── Dockerfile
├── otel-collector-config.yml
├── requirements.txt
├── .env
└── .dockerignore
```

## Funcionalidades

- Página inicial com botão para testar `GET /health`
- Página de cadastro de pessoas
- Salvamento de pessoas no PostgreSQL
- Instrumentação com OpenTelemetry
- Envio de traces/logs para o Grafana Cloud

## Rotas

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Página inicial |
| GET | `/health` | Health check da aplicação |
| GET | `/pessoas` | Página de cadastro/listagem de pessoas |
| POST | `/pessoas` | Cadastra uma pessoa no banco |

## Configuração do `.env`

Crie um arquivo `.env` na raiz do projeto:

```bash
touch .env
```

Exemplo de conteúdo:

```env
POSTGRES_DB=grafana_o11y
POSTGRES_USER=grafana
POSTGRES_PASSWORD=grafana
DATABASE_URL=postgresql://grafana:grafana@postgres:5432/grafana_o11y

GRAFANA_CLOUD_OTLP_ENDPOINT=https://SEU-ENDPOINT-OTLP-AQUI
GRAFANA_CLOUD_INSTANCE_ID=SEU-INSTANCE-ID-AQUI
GRAFANA_CLOUD_API_KEY=SEU-TOKEN-AQUI
```

## Subir o projeto

Execute na raiz do projeto:

```bash
docker compose up -d --build
```

Verifique se os containers subiram:

```bash
docker ps
```

Containers esperados:

```text
grafana-o11y
grafana-o11y-postgres
otel-collector
```

## Acessar a aplicação

Página inicial:

```text
http://localhost:8000/
```

Cadastro de pessoas:

```text
http://localhost:8000/pessoas
```

Health check:

```text
http://localhost:8000/health
```

## Testar via terminal

Health check:

```bash
curl -s http://localhost:8000/health | jq
```

Cadastrar pessoa via `curl`:

```bash
curl -i -X POST http://localhost:8000/pessoas \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "nome=Giorgio&email=giorgio@email.com"
```

Consultar página de pessoas via terminal:

```bash
curl -s http://localhost:8000/pessoas
```

## Ver logs

Todos os serviços:

```bash
docker compose logs -f
```

Somente aplicação:

```bash
docker compose logs -f app
```

Somente OpenTelemetry Collector:

```bash
docker compose logs -f otel-collector
```

Somente PostgreSQL:

```bash
docker compose logs -f postgres
```

## Acessar o PostgreSQL

Entrar no container do PostgreSQL:

```bash
docker exec -it grafana-o11y-postgres psql -U grafana -d grafana_o11y
```

Listar pessoas cadastradas:

```sql
SELECT * FROM pessoas;
```

Sair do PostgreSQL:

```sql
\q
```

## Gerar tráfego para observabilidade

Executar algumas chamadas:

```bash
curl -s http://localhost:8000/health | jq
curl -s http://localhost:8000/pessoas > /dev/null
```

Cadastrar várias pessoas:

```bash
curl -i -X POST http://localhost:8000/pessoas \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "nome=Pessoa Teste&email=pessoa@email.com"
```

Loop simples para gerar tráfego:

```bash
while true; do
  curl -s http://localhost:8000/health | jq
  curl -s http://localhost:8000/pessoas > /dev/null
  sleep 2
done
```

## Monitoramento no Grafana Cloud

No Grafana Cloud, procure pelo serviço:

```text
grafana-o11y
```

Rotas esperadas nos traces:

```text
GET /
GET /health
GET /pessoas
POST /pessoas
```

Também pode aparecer span relacionado ao PostgreSQL/SQLAlchemy ao cadastrar pessoas.

## Parar o projeto

```bash
docker compose down
```

## Parar e apagar dados do PostgreSQL

Use este comando apenas se quiser remover também o volume do banco:

```bash
docker compose down -v
```

## Rebuild do projeto

Quando alterar código, dependências ou Dockerfile:

```bash
docker compose down
docker compose up -d --build
```

## Ver status dos containers

```bash
docker ps
```

## Ver imagens Docker

```bash
docker images
```

## Remover container manualmente

```bash
docker stop grafana-o11y
docker rm grafana-o11y
```

## Observação sobre métricas

As métricas foram desabilitadas no OpenTelemetry para evitar limite de ingestão no plano Free do Grafana Cloud.

No `docker-compose.yml`:

```yaml
OTEL_METRICS_EXPORTER: none
```

Traces e logs continuam sendo enviados normalmente para o Grafana Cloud.