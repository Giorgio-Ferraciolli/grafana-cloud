# FastAPI + Grafana Alloy APM

Projeto simples em **FastAPI** com endpoints para testes de requests e instrumentação com **OpenTelemetry + Grafana Alloy**.

## Endpoints

| Método | Rota |
|----------|----------|
| GET | `/health` |
| POST | `/minha-api` |

---

## Pré-requisitos

- Ubuntu / WSL
- Python 3.10+
- Grafana Alloy instalado
- Conta no Grafana Cloud

---

## 1. Criar ambiente virtual

```bash
python3 -m venv venv
source venv/bin/activate
```

---

## 2. Instalar dependências

```bash
pip install -r requirements.txt
opentelemetry-bootstrap -a install
```

---

## 3. Configurar variáveis de ambiente

Crie um arquivo `.env` baseado no exemplo:

```bash
cp .env.example .env
```

Ou exporte diretamente:

```bash
export OTEL_SERVICE_NAME=fastapi-wsl-test
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```

Verifique:

```bash
echo $OTEL_SERVICE_NAME
```

---

## 4. Configurar o Grafana Alloy

Copie o arquivo de exemplo:

```bash
cp config.alloy.example config.alloy
```

Edite:

```bash
nano config.alloy
```

Preencha os campos:

```alloy
username = "SEU_INSTANCE_ID"
password = "SEU_TOKEN_GRAFANA_CLOUD"
```

Exemplo:

```alloy
otelcol.receiver.otlp "default" {
  grpc {
    endpoint = "127.0.0.1:4317"
  }

  http {
    endpoint = "127.0.0.1:4318"
  }

  output {
    traces = [otelcol.exporter.otlphttp.grafana.input]
  }
}

otelcol.auth.basic "grafana" {
  username = "SEU_INSTANCE_ID"
  password = "SEU_TOKEN_GRAFANA_CLOUD"
}

otelcol.exporter.otlphttp "grafana" {
  client {
    endpoint = "https://otlp-gateway-prod-sa-east-1.grafana.net/otlp"
    auth = otelcol.auth.basic.grafana.handler
  }
}
```

---

## 5. Iniciar o Grafana Alloy

Abra um terminal dedicado e execute:

```bash
alloy run config.alloy
```

Saída esperada:

```text
Starting GRPC server endpoint=127.0.0.1:4317
Starting HTTP server endpoint=127.0.0.1:4318
```

O Alloy ficará recebendo traces localmente e enviando para o Grafana Cloud.

---

## 6. Iniciar a API instrumentada

Abra outro terminal:

```bash
source venv/bin/activate
```

Carregue as variáveis:

```bash
export OTEL_SERVICE_NAME=fastapi-wsl-test
export OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4317
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
```

Execute a aplicação:

```bash
opentelemetry-instrument uvicorn main:app --host 0.0.0.0 --port 5000
```

Saída esperada:

```text
Uvicorn running on http://0.0.0.0:5000
```

---

## 7. Testar a API

### Health Check

```bash
curl http://localhost:5000/health
```

Resposta esperada:

```json
{
  "status": "UP",
  "timestamp": "2026-06-02T18:00:00",
  "requests": 1
}
```

### POST

```bash
curl -X POST http://localhost:5000/minha-api \
-H "Content-Type: application/json" \
-d '{
  "nome": "Pessoa",
  "idade": 29
}'
```

Resposta esperada:

```json
{
  "mensagem": "Request recebida com sucesso",
  "dados": {
    "nome": "Pessoa",
    "idade": 29
  },
  "requests": 2
}
```

---

## 8. Visualizar traces no Grafana Cloud

Acesse sua Stack Grafana Cloud.

Procure pelo serviço:

```text
fastapi-wsl-test
```

Locais comuns:

```text
Application Observability
```

ou

```text
Explore → Traces
```

ou

```text
Tempo → Search
```

Após gerar requests, os traces devem aparecer em alguns segundos.

---

## Estrutura do Projeto

```text
fastapi-alloy-apm/
├── main.py
├── requirements.txt
├── config.alloy.example
├── .env.example
├── .gitignore
└── README.md
```

---

## Tecnologias Utilizadas

- FastAPI
- OpenTelemetry
- Grafana Alloy
- Grafana Cloud
- Tempo (Distributed Tracing)
- Python 3