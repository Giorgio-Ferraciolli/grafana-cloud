-- Usuário somente leitura para o exporter de MySQL do Grafana Alloy.
-- Não tem acesso às tabelas da aplicação: só a métricas do servidor (performance_schema).
-- A senha precisa bater com MYSQL_EXPORTER_DSN no .env.
CREATE USER IF NOT EXISTS 'exporter'@'%' IDENTIFIED BY 'exporter_pass' WITH MAX_USER_CONNECTIONS 3;
GRANT PROCESS, REPLICATION CLIENT ON *.* TO 'exporter'@'%';
GRANT SELECT ON performance_schema.* TO 'exporter'@'%';
FLUSH PRIVILEGES;
