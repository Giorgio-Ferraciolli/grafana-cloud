#!/bin/bash
# Cria usuários, a tabela items e os itens iniciais.
# Roda UMA vez, quando o volume pg-data é criado. Para rodar de novo: docker compose down -v
set -euo pipefail

: "${APP_DB_PASSWORD:?defina APP_DB_PASSWORD no .env}"
: "${MONITOR_DB_PASSWORD:?defina MONITOR_DB_PASSWORD no .env}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
     -v app_password="$APP_DB_PASSWORD" \
     -v monitor_password="$MONITOR_DB_PASSWORD" <<'SQL'
-- Estatísticas por query (precisa do shared_preload_libraries do compose)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Tabela única, usada pelas duas APIs (flask-lab-api e java-lab-api).
-- Os testes da java-lab-api têm uma cópia deste DDL: mude os dois juntos.
CREATE TABLE items (
    id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome       text   NOT NULL CHECK (btrim(nome) <> ''),
    quantidade bigint NOT NULL DEFAULT 1 CHECK (quantidade >= 0)
);

INSERT INTO items (nome, quantidade) VALUES ('notebook', 2), ('monitor', 1);

-- Usuário das APIs: só lê e grava na tabela items
CREATE ROLE lab_app LOGIN PASSWORD :'app_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON items TO lab_app;

-- Usuário do Alloy (métricas + Database Observability): só leitura.
-- O nome "db-o11y" é o padrão do Grafana; o Alloy já ignora as queries dele.
CREATE ROLE "db-o11y" LOGIN PASSWORD :'monitor_password';
GRANT pg_monitor TO "db-o11y";
ALTER ROLE "db-o11y" SET pg_stat_statements.track = 'none';
-- Para ler o schema e rodar EXPLAIN nas queries das APIs
GRANT USAGE ON SCHEMA public TO "db-o11y";
GRANT SELECT ON items TO "db-o11y";
SQL
