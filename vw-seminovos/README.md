# VW Seminovos

Site de laboratório para venda de Volkswagen seminovos, com 15 carros em estoque
(Polo, Polo Track, Golf GTI, Nivus, T-Cross, Tera, Virtus, Jetta GLI, Taos, Tiguan Allspace, ID.4, Saveiro e Amarok).
Os dados (preços, km, versões) são fictícios.

## Páginas do site

O frontend é uma SPA com rotas por hash (`#/...`), então funciona com o Nginx sem configuração extra.

| Rota              | O que faz                                                                    |
|-------------------|------------------------------------------------------------------------------|
| `#/`              | Estoque com filtros (categoria, combustível, preço), busca e ordenação       |
| `#/carro/{id}`    | Detalhe do carro, proposta, agendamento de test drive e carros similares     |
| `#/simulador/{id}`| Simulador de financiamento; envia a simulação como proposta                  |
| `#/comparar/1,2,3`| Compara até 3 carros lado a lado, destacando o melhor valor de cada linha    |
| `#/vender`        | Estimativa de valor do usado e pedido de avaliação presencial                |
| `#/favoritos`     | Carros favoritados (salvos no navegador)                                     |
| `#/painel`        | Painel da loja: indicadores e status de propostas, test drives e avaliações  |
| `#/creditos`      | Créditos e licenças das fotos                                                |

> O painel não tem login. É só para o laboratório; não exponha esse projeto na internet como está.

## Stack

| Serviço    | Tecnologia                  | Porta no host |
|------------|-----------------------------|---------------|
| `frontend` | HTML/CSS/JS servido por Nginx | 8080        |
| `backend`  | Python 3.12 + FastAPI       | 8000          |
| `db`       | MySQL 8.4                   | 3307          |
| `alloy`    | Grafana Alloy (observabilidade) | 12345 (UI) |

O Nginx faz proxy de `/api/*` para o backend e de `/collect` para o Alloy.

Métricas, logs e traces vão para o Grafana Cloud pelo Alloy. O passo a passo completo está em
[OBSERVABILIDADE.md](OBSERVABILIDADE.md).

## Como subir

Pré-requisitos: Docker Desktop rodando e o arquivo `.env` com as credenciais do Grafana Cloud.
Se ele não existir, copie o `.env.example` e preencha. No PowerShell, dentro da pasta do projeto:

```powershell
docker compose up -d --build
```

Aguarde ~30 s na primeira vez (o MySQL cria o banco e carrega os dados) e acesse:

- Site: http://localhost:8080
- Documentação da API (Swagger): http://localhost:8000/docs
- Health check: http://localhost:8000/api/health

## Endpoints

| Método | Rota                                   | Descrição                                            |
|--------|----------------------------------------|------------------------------------------------------|
| GET    | `/api/health`                          | Status da API e do banco                             |
| GET    | `/api/cars`                            | Lista os carros                                      |
| GET    | `/api/cars/{id}`                       | Detalhe de um carro                                  |
| POST   | `/api/leads`                           | Registra uma proposta                                |
| GET    | `/api/leads?status=`                   | Lista as propostas (filtro opcional por status)      |
| PATCH  | `/api/leads/{id}`                      | Altera o status (`{"status": "em contato"}`)         |
| GET    | `/api/test-drives/slots?car_id=&date=` | Horários livres de um carro numa data                |
| POST   | `/api/test-drives`                     | Agenda test drive (409 se o horário já foi tomado)   |
| GET    | `/api/test-drives?status=`             | Lista os agendamentos                                |
| PATCH  | `/api/test-drives/{id}`                | Altera o status                                      |
| GET    | `/api/valuation/models`                | Modelos aceitos na avaliação de usado                |
| POST   | `/api/valuation`                       | Calcula a estimativa (não grava nada)                |
| POST   | `/api/sell-requests`                   | Grava pedido de avaliação com a estimativa           |
| GET    | `/api/sell-requests?status=`           | Lista os pedidos de avaliação                        |
| PATCH  | `/api/sell-requests/{id}`              | Altera o status                                      |
| GET    | `/api/statuses`                        | Status válidos de cada tipo de registro              |
| GET    | `/api/stats`                           | Indicadores do painel                                |

Regras do test drive: segunda a sexta das 9h às 17h, sábado das 9h às 12h, até 30 dias à frente, horário de Brasília.

## Banco de dados

Conexão a partir do Windows (DBeaver, Workbench etc.):

- Host `localhost`, porta `3307`, banco `vw_seminovos`
- Usuário `vw_user`, senha `vw_pass` (root: `root123`)

Via terminal:

```powershell
docker exec -it vw-db mysql -uvw_user -pvw_pass vw_seminovos -e "SELECT * FROM leads;"
```

Tabelas: `cars` (estoque), `leads` (propostas), `test_drives` (agendamentos) e `sell_requests` (avaliações de usado).
O schema base está em `db/init.sql` e a versão 2 (novas tabelas e mais 11 carros) em `db/02_v2.sql`.
Os dois rodam em ordem quando o volume do banco é criado.

### Atualizando um banco existente

Se o seu volume foi criado antes da v2, aplique o script uma única vez, sem perder dados:

```powershell
docker cp db\02_v2.sql vw-db:/tmp/02_v2.sql
docker exec vw-db sh -c "mysql -uroot -proot123 --default-character-set=utf8mb4 < /tmp/02_v2.sql"
```

## Comandos úteis

```powershell
docker compose ps                 # status dos containers
docker compose logs -f backend    # logs da API
docker compose down               # para tudo (mantém os dados)
docker compose down -v            # para tudo e apaga o banco
```

> Os scripts de `db/` só rodam quando o volume do banco está vazio. Se alterá-los, use `docker compose down -v` antes de subir de novo (isso apaga os dados).

## Estrutura

```
vw-seminovos/
├── docker-compose.yml
├── backend/     # FastAPI (main.py, Dockerfile, requirements.txt)
├── frontend/    # index.html, styles.css, app.js, img/, nginx.conf, Dockerfile
├── db/          # init.sql (schema + dados), 02_v2.sql (v2) e 03_monitoring.sql (usuário do exporter)
├── alloy/       # config.alloy (coleta e envio ao Grafana Cloud)
├── grafana/     # dashboard para importar no Grafana Cloud
├── .env         # credenciais do Grafana Cloud (não versionado; modelo em .env.example)
└── OBSERVABILIDADE.md
```

As fotos novas vêm do Wikimedia Commons (licenças CC BY e CC BY-SA). Os autores estão em `frontend/img/CREDITOS.md` e na página `#/creditos`.

## Problemas comuns

- **Porta em uso**: altere o lado esquerdo do mapeamento em `docker-compose.yml` (ex.: `"8081:80"`).
- **Estoque não carrega**: confira `docker compose ps` — o backend só sobe depois que o `db` fica `healthy`.
