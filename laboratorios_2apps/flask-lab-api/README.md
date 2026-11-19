# Lab: API Flask em Docker (WSL Ubuntu)

API com endpoints GET e POST, servida por gunicorn dentro de um container.
Os itens ficam no PostgreSQL do [`../postgres-lab`](../postgres-lab/README.md), na tabela
`items`, a **mesma** usada pela `java-lab-api`: o que uma cria, a outra enxerga.

## Estrutura

```
.
├── app.py
├── static/            # frontend: index.html, style.css, app.js
├── requirements.txt
├── Dockerfile
├── .dockerignore
└── README.md
```

A pasta `data/` com o `items.json` antigo não é mais usada (ficou só como histórico; pode apagar).

## Subir o ambiente

No terminal do WSL Ubuntu:

É o serviço `flask-lab-api` do [`docker-compose.yml`](../docker-compose.yml) da raiz (porta,
conexão com o banco, OTel/Pyroscope e healthcheck estão lá). No terminal do WSL, na raiz:

```bash
docker compose up -d --build --wait flask-lab-api   # sobe o banco e o Alloy junto, se precisar
docker compose logs -f flask-lab-api                # acompanhar os logs
```

Parar (os dados continuam no banco):

```bash
docker compose stop flask-lab-api
```

A senha do banco vem do `.env` da raiz: o compose passa a `APP_DB_PASSWORD` como
`DB_PASSWORD`. Sem ela, o `docker compose up` para com `defina APP_DB_PASSWORD no .env`.

## Endpoints

| Método | Rota          | Descrição                                       |
|--------|---------------|-------------------------------------------------|
| GET    | `/`           | Frontend (abra http://localhost:5000 no navegador) |
| GET    | `/health`     | Healthcheck (faz um `SELECT` no banco)          |
| GET    | `/items`      | Lista items (filtro `?nome=`)                   |
| GET    | `/items/<id>` | Busca um item por id                            |
| POST   | `/items`      | Cria um item no banco (o id vem do banco)       |
| PATCH  | `/items/<id>` | Edita `nome` e/ou `quantidade` de um item       |
| DELETE | `/items/<id>` | Remove um item por id                           |

## Testes via curl

Health:

```bash
curl -s http://localhost:5000/health
```

GET — listar todos:

```bash
curl -s http://localhost:5000/items
```

GET — com filtro e saída formatada:

```bash
curl -s "http://localhost:5000/items?nome=monitor" | jq
```

GET — por id:

```bash
curl -s http://localhost:5000/items/1
```

POST — criar item:

```bash
curl -s -X POST http://localhost:5000/items \
  -H "Content-Type: application/json" \
  -d '{"nome": "teclado", "quantidade": 3}'
```

POST — `quantidade` é opcional (default 1):

```bash
curl -s -X POST http://localhost:5000/items \
  -H "Content-Type: application/json" \
  -d '{"nome": "mouse"}'
```

POST — ver o status HTTP junto:

```bash
curl -i -X POST http://localhost:5000/items \
  -H "Content-Type: application/json" \
  -d '{"nome": "webcam", "quantidade": 5}'
```

POST — erro de validação (422):

```bash
curl -s -X POST http://localhost:5000/items \
  -H "Content-Type: application/json" \
  -d '{"quantidade": 3}'
```

PATCH — editar um item (só os campos enviados mudam):

```bash
curl -s -X PATCH http://localhost:5000/items/3 \
  -H "Content-Type: application/json" \
  -d '{"quantidade": 10}'
```

DELETE — remover item por id (404 se não existir):

```bash
curl -s -X DELETE http://localhost:5000/items/3
```

## Teste de persistência

A prova de que está gravando no banco (e que o banco é o mesmo da API Java):

```bash
curl -s -X POST http://localhost:5000/items \
  -H "Content-Type: application/json" -d '{"nome":"teclado","quantidade":3}'
docker exec postgres-lab psql -U postgres -d lab -c 'SELECT * FROM items ORDER BY id'
docker compose restart flask-lab-api && sleep 3
curl -s http://localhost:5000/items          # o teclado continua lá
curl -s "http://localhost:5050/items?nome=teclado"   # e a API Java também enxerga
```

## Problemas comuns no WSL

**`503` com `banco de dados inacessível` / `banco de dados indisponível`**

A API está de pé, mas não alcança o Postgres. O container fica `unhealthy` depois de
~90s. Veja:

```bash
docker compose ps postgres-lab                     # o banco está healthy?
docker logs flask-lab-api 2>&1 | grep -i 'banco'   # o motivo exato
```

- `Connection refused`: o banco está fora. `docker compose start postgres-lab`; a API volta sozinha.
- `password authentication failed for user "lab_app"`: a `APP_DB_PASSWORD` do `.env` não é a
  senha com que o volume do banco foi criado (veja [postgres-lab](../postgres-lab/README.md#problemas-comuns)).

**Zerar os itens**

O banco é compartilhado: zerar aqui zera para a API Java também.
`docker compose down -v && docker compose up -d --build --wait` (na raiz)
(volta com os 2 itens iniciais).

**`docker: command not found` ou a porta não responde**

Use o terminal do WSL (não o PowerShell) e confirme a integração WSL no Docker
Desktop: Settings → Resources → WSL Integration.

## Notas de implementação

- **psycopg 3 + pool**: um `ConnectionPool` de até 4 conexões (uma por thread do gunicorn:
  `--workers 1 --threads 4`). Cada endpoint é uma única instrução SQL com commit automático;
  POST/PATCH/DELETE usam `RETURNING` para devolver o item sem uma segunda query.
- **Ids**: vêm do banco (`GENERATED ALWAYS AS IDENTITY`). Não há mais trava na API e o id
  nunca se repete, nem quando o item de maior id é excluído (no JSON ele voltava).
- **Filtro `?nome=`**: `strpos(lower(nome), lower(...))`, então `%` e `_` são texto comum,
  não curingas do `LIKE`.
- **Banco fora**: a API sobe mesmo assim (o pool abre em segundo plano) e responde 503 em
  JSON em até ~2s (`connect_timeout`/`timeout` do pool). Quando o banco volta, se recupera
  sem restart.
- **Traces**: o `opentelemetry-instrumentation-psycopg` cria um span por query (com o SQL em
  `db.statement`) dentro do trace da requisição. Ver `../observability/README.md`.
- **Desenvolvimento sem container**, com reload automático (o banco publica a 5432 no host):
  ```bash
  pip install -r requirements.txt
  DB_PASSWORD=... python app.py
  ```
