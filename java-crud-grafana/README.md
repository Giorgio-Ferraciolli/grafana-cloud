# java-crud-grafana

API Java simples com endpoint de health check, formulario para criar itens via POST e observabilidade com Grafana Cloud.

O frontend fica em `src/main/resources/static/index.html`, e a API serve esse arquivo em `/`.

## Rodar com Docker Compose e Grafana Cloud

Crie o arquivo `.env` com suas credenciais Grafana Cloud. Este projeto usa as mesmas variaveis do projeto `ferrari-sale`.

```bash
cp .env.example .env
docker compose up --build -d
docker compose ps
```

O Alloy envia metricas Prometheus de `/metrics`, logs dos containers para Loki e traces OpenTelemetry para Tempo.

Depois, abra no navegador:

```text
http://localhost:8080
```

O Alloy fica disponivel localmente em:

```text
http://localhost:12346
```

## Testar

```bash
curl http://localhost:8080/health
```

Resposta esperada:

```json
{"status":"ok","service":"java-crud-grafana"}
```

## Testar metricas

```bash
curl http://localhost:8080/metrics
```

## Criar item via POST

```bash
curl -X POST http://localhost:8080/items \
  -H "Content-Type: application/json" \
  -d '{"title":"Primeiro registro","description":"Salvo em arquivo JSON"}'
```

Os itens sao salvos no arquivo configurado por `DATA_FILE`. No Docker, o padrao e `/app/data/items.json`.

Com o volume do comando acima, o arquivo tambem aparece no seu projeto em:

```text
data/items.json
```
