# postgres-lab — banco do laboratório

Um PostgreSQL 18 em Docker, compartilhado pelas duas APIs: a `flask-lab-api` e a `java-lab-api`
gravam e leem a **mesma tabela** `items`. O que uma cria, a outra enxerga.

| O quê      | Valor                                                       |
|------------|-------------------------------------------------------------|
| Host/porta | `localhost:5432` (das APIs e do Alloy, na rede do compose: `postgres-lab:5432`) |
| Banco      | `lab`                                                       |
| Tabela     | `items (id bigint identity, nome text, quantidade bigint)`  |
| Usuários   | `postgres` (admin) · `lab_app` (as APIs, só CRUD em `items`) · `db-o11y` (Alloy, só leitura) |
| Volume     | `laboratorios_pg-data` (sobrevive a `down` e rebuild)       |

## Subir

É o serviço `postgres-lab` do [`docker-compose.yml`](../docker-compose.yml) da raiz. O compose
já sobe o banco antes das APIs e do Alloy (`depends_on` com healthcheck). Na raiz:

```bash
docker compose up -d --wait postgres-lab   # só o banco
docker compose ps postgres-lab             # "healthy"
```

As 3 senhas ficam no `.env` da raiz (`openssl rand -hex 24`), e o compose repassa:

| No `.env` da raiz     | Usada por                                                   |
|-----------------------|-------------------------------------------------------------|
| `POSTGRES_PASSWORD`   | superusuário `postgres`                                     |
| `APP_DB_PASSWORD`     | `lab_app`: vira o `DB_PASSWORD` das duas APIs               |
| `MONITOR_DB_PASSWORD` | `db-o11y`: entra no `POSTGRES_DSN` do Alloy                 |

O script `initdb/01-init.sh` cria a tabela, os usuários e os 2 itens iniciais. Ele **só roda
quando o volume é criado**: mudar senha no `.env` depois não muda a senha no banco.

## Acessar

```bash
docker exec -it postgres-lab psql -U postgres -d lab

# dentro do psql
SELECT * FROM items ORDER BY id;
SELECT application_name, state, count(*) FROM pg_stat_activity
 WHERE datname = 'lab' GROUP BY 1, 2;          -- conexões de cada API
SELECT calls, round(mean_exec_time::numeric, 2) AS ms, query
  FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;  -- queries mais caras
```

Do Windows (DBeaver, pgAdmin): `localhost:5432`, banco `lab`, usuário `postgres`.

## Zerar o banco

Na raiz:

```bash
docker compose down -v                # -v apaga os volumes: todos os itens somem
docker compose up -d --build --wait   # o initdb roda de novo: 2 itens, próximo id = 3
```

## Configuração para observabilidade

Ligada no `command:` do compose (precisa de restart para mudar):

- `pg_stat_statements` (+ `compute_query_id`, `track_activity_query_size=4096`,
  `track_io_timing`): estatística por query, usada pelo Alloy nas métricas e no
  Database Observability do Grafana Cloud.
- `log_min_duration_statement=200ms` e `log_lock_waits=on`: queries lentas e esperas por lock
  aparecem no log, que o Alloy manda para o Loki (`{service_name="postgres-lab"}`).
- `log_line_prefix` com `usuario@banco app=<application_name>`: nos logs dá para ver qual API
  fez a query (`app=flask-lab-api` / `app=java-lab-api`).

O que olhar no Grafana está em [../observability/README.md](../observability/README.md).

## Problemas comuns

**APIs com `/health` 503 `banco de dados inacessível`**
O banco está fora (`docker compose ps postgres-lab`) ou a senha não bate (`docker logs postgres-lab` mostra
`password authentication failed for user "lab_app"`). Confira a tabela de senhas acima.

**`password authentication failed` depois de trocar a senha no `.env`**
O `.env` só vale na criação do volume. Ou troque no banco
(`ALTER ROLE lab_app PASSWORD '...'`), ou zere com `docker compose down -v` (na raiz).

**Porta 5432 ocupada**
Outro Postgres no host (`ss -ltnp | grep 5432`). Troque o lado esquerdo do `ports` (ex.:
`"5433:5432"`) no `docker-compose.yml` da raiz. As APIs e o Alloy não mudam: falam com a 5432 de dentro
da rede do compose.
