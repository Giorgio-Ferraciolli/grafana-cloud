# laboratorios

Todo o laboratório roda num compose só: [`docker-compose.yml`](docker-compose.yml) (projeto
`laboratorios`). Os containers se falam pela rede do compose, pelo nome do serviço
(`postgres-lab:5432`, `alloy:4317`, `flask-lab-api:5000`...); as portas abaixo são as
publicadas no host.

| Serviço                                   | O que é                                         | Portas no host |
|-------------------------------------------|-------------------------------------------------|----------------|
| [postgres-lab](postgres-lab/README.md)    | PostgreSQL 18, banco compartilhado pelas APIs   | 5432 |
| [alloy](observability/README.md)          | Grafana Alloy: logs, traces, métricas e profiles → Grafana Cloud | 12345 (UI), 4317/4318 (OTLP), 4040 (Pyroscope) |
| [flask-lab-api](flask-lab-api/README.md)  | API + tela em Python/Flask (gunicorn)           | 5000 |
| [java-lab-api](java-lab-api/README.md)    | API + tela em Java 21/Spring Boot               | 5050 |
| [k6](load-test/)                          | Teste de carga nas duas APIs (sob demanda, perfil `load-test`) | — |

```
laboratorios/
├── docker-compose.yml     # tudo
├── .env                   # senhas e tokens de tudo (não versionar)
├── .env.example
├── postgres-lab/initdb/   # cria tabela e usuários na criação do volume
├── observability/config.alloy
├── flask-lab-api/         # código + Dockerfile
├── java-lab-api/          # código + Dockerfile
└── load-test/script.js
```

## Pré-requisitos

- Docker Desktop aberto, com a integração WSL ligada para esta distro
  (Settings → Resources → WSL Integration). Rode tudo pelo terminal do WSL.
- O `.env` na raiz (`cp .env.example .env && chmod 600 .env` e preencha). Ele tem as 3 senhas
  do banco e os tokens do Grafana Cloud; o compose repassa cada uma para quem precisa
  (`APP_DB_PASSWORD` vira o `DB_PASSWORD` das APIs, `MONITOR_DB_PASSWORD` entra no
  `POSTGRES_DSN` do Alloy). Sem uma variável, o compose para com `defina ... no .env`.

## Subir tudo

```bash
docker compose up -d --build --wait
```

Sobe na ordem `postgres-lab` → `alloy` → `flask-lab-api` + `java-lab-api` (o `depends_on`
espera o banco ficar healthy antes do resto), rebuilda as imagens das APIs e o `--wait` só
volta quando tudo estiver healthy. O build da Java roda os testes (a primeira vez demora).

No final:

- Flask: http://localhost:5000
- Java: http://localhost:5050
- Alloy: http://localhost:12345
- Postgres: `localhost:5432`, banco `lab`

## Comandos

| Comando                                          | O que faz |
|--------------------------------------------------|-----------|
| `docker compose up -d --build --wait`            | build + sobe tudo + espera healthy |
| `docker compose up -d --build --wait flask-lab-api` | só um serviço (sobe junto o que ele precisa: banco e Alloy) |
| `docker compose down`                            | para e remove os containers (os dados do banco ficam no volume) |
| `docker compose stop java-lab-api`               | para um serviço só (`start` para voltar) |
| `docker compose restart alloy`                   | reinicia um serviço, sem rebuild (ex.: depois de mudar o `config.alloy`) |
| `docker compose ps`                              | estado dos containers |
| `docker compose logs -f --tail 50 java-lab-api`  | logs de um serviço (sem nome: todos) |
| `docker compose run --rm k6`                     | teste de carga k6 nas duas APIs por 10 min |
| `DURATION=30s docker compose run --rm k6`        | teste de carga mais curto |

O teste de carga grava itens `item-teste-N` no banco compartilhado. Para zerar o banco, veja
[postgres-lab/README.md](postgres-lab/README.md#zerar-o-banco).

## Volumes

| Volume                     | O quê |
|----------------------------|-------|
| `laboratorios_pg-data`     | dados do Postgres (sobrevive a `down` e rebuild; `down -v` apaga) |
| `laboratorios_alloy-data`  | WAL/estado do Alloy |
