# java-crud-grafana

API Java simples com endpoint de health check e formulario para criar itens via POST.

O frontend fica em `src/main/resources/static/index.html`, e a API serve esse arquivo em `/`.

## Rodar com Docker

```bash
docker build -t java-crud-grafana .
docker run --rm -p 8080:8080 --user "$(id -u):$(id -g)" -v "$(pwd)/data:/app/data" java-crud-grafana
```

Depois, abra no navegador:

```text
http://localhost:8080
```

## Testar

```bash
curl http://localhost:8080/health
```

Resposta esperada:

```json
{"status":"ok","service":"java-crud-grafana"}
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
