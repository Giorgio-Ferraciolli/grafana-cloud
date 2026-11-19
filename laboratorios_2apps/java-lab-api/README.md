# java-lab-api

API REST de laboratório em **Java 21 + Spring Boot 3**, equivalente à `flask-lab-api`.
Roda na porta **5050** (a Flask usa a 5000), para que as duas possam ficar no ar ao mesmo tempo.

Os itens ficam no PostgreSQL do [`../postgres-lab`](../postgres-lab/README.md), na tabela
`items`, a **mesma** usada pela `flask-lab-api`: o que uma cria, a outra enxerga.

**Interface web:** http://localhost:5050/

A tela é servida pelo próprio Spring Boot (mesma porta, mesma origem, sem CORS, sem serviço
extra). Ela usa a mesma API e o mesmo banco: o que você cria pelo curl (ou pela API Flask)
aparece na tela (recarregue a página) e vice-versa.

## Estrutura

```
java-lab-api/
├── pom.xml
├── Dockerfile                 # multi-stage: Maven (compila + testa) -> JRE alpine
├── .dockerignore              # exclui target/, data/, .env
└── src/
    ├── main/java/br/lab/api/
    │   ├── Application.java
    │   ├── Item.java                  # {"id", "nome", "quantidade"}
    │   ├── ItemStore.java             # persistência: SQL na tabela items (JdbcClient + HikariCP)
    │   ├── ItemController.java        # /health e /items (GET, POST, PUT, DELETE)
    │   ├── ValidacaoException.java    # erros 400/422 de validação do body
    │   ├── FrontendController.java    # GET / -> static/index.html
    │   ├── ApiExceptionHandler.java   # erros do Spring -> JSON (404, 405, banco fora = 503, 500)
    │   ├── JsonErrorController.java   # /error do Spring Boot -> JSON
    │   ├── JsonErrorReportValve.java  # erros do próprio Tomcat (URL malformada) -> JSON
    │   ├── TomcatConfig.java          # instala a valve acima
    │   └── WebConfig.java             # sempre JSON + serve /app.js e /style.css
    ├── main/resources/
    │   ├── application.properties     # conexão com o banco (DB_HOST, DB_PASSWORD...)
    │   └── static/                    # frontend: HTML + CSS + JS puro, sem CDN nem build
    │       ├── index.html
    │       ├── style.css
    │       └── app.js
    └── test/java/br/lab/api/
        ├── ApiTest.java               # 59 testes HTTP de ponta a ponta, num PostgreSQL real
        ├── BancoForaTest.java         # 4 testes com o banco fora do ar (503)
        └── BancoDeTeste.java          # sobe um PostgreSQL 18 embutido durante o mvn test
```

A pasta `data/` com o `items.json` antigo não é mais usada (ficou só como histórico; pode apagar).

## Como subir

É o serviço `java-lab-api` do [`docker-compose.yml`](../docker-compose.yml) da raiz (porta 5050,
conexão com o banco, OTel/Pyroscope e healthcheck estão lá). Na raiz:

```bash
# build (compila e roda os testes dentro do Docker), sobe e espera ficar healthy;
# sobe o banco e o Alloy junto, se precisar
docker compose up -d --build --wait java-lab-api
```

A senha do banco vem do `.env` da raiz: o compose passa a `APP_DB_PASSWORD` como `DB_PASSWORD`.

Não é preciso Java nem Maven instalados no WSL: tudo roda no Docker.
O `docker compose build` **falha se algum teste falhar**. Os testes não usam o banco do
`postgres-lab`: cada `mvn test` sobe um PostgreSQL 18 próprio e descartável (binário embutido
da biblioteca zonky, sem Docker), numa porta livre.

Para rodar só os testes, sem gerar imagem (como o seu usuário: o `target/` não sai como root e
o Postgres embutido se recusa a rodar como root):

```bash
docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/src -w /src \
  maven:3.9-eclipse-temurin-21 mvn -B -Dmaven.repo.local=/tmp/m2 test
```

Variáveis de ambiente (já estão no compose da raiz): `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`.

## Endpoints

| Método | Rota          | Sucesso                              | Erros |
|--------|---------------|--------------------------------------|-------|
| GET    | `/health`     | 200 `{"status":"ok","total":n}`      | 503 `{"status":"erro","detalhe":"banco de dados inacessível: ..."}` |
| GET    | `/items`      | 200 `{"items":[...],"total":n}`      | — |
| GET    | `/items?nome=` | 200, filtro por substring sem diferenciar maiúsculas | — |
| GET    | `/items/{id}` | 200 o item                           | 404 `{"erro":"item não encontrado","id":id}` |
| POST   | `/items`      | 201 o item criado                    | 400 corpo não é objeto JSON · 422 `nome` inválido · 422 `quantidade` inválida |
| PUT    | `/items/{id}` | 200 o item atualizado                | mesmos 400/422 do POST · 404 `{"erro":"item não encontrado","id":id}` |
| DELETE | `/items/{id}` | 204 sem corpo                        | 404 `{"erro":"item não encontrado","id":id}` |
| GET    | `/`           | 200 a interface web (HTML)           | — |
| *      | rota inexistente | —                                 | 404 `{"erro":"rota não encontrada"}` |
| *      | método errado | —                                    | 405 `{"erro":"método não permitido"}` |

Body do POST e do PUT: `{"nome":"teclado","quantidade":3}`. `quantidade` é opcional (padrão 1) e
precisa ser inteiro >= 0 (`"3"`, `1.5`, `true` e `null` são rejeitados). `nome` é obrigatório,
texto e não vazio (espaços nas pontas são removidos). O body precisa ter
`Content-Type: application/json`. O PUT substitui o item inteiro (sem `quantidade` = 1).

Cada POST, PUT e DELETE é uma única instrução SQL (com `RETURNING`), com commit automático.
O id vem do banco (`GENERATED ALWAYS AS IDENTITY`): **nunca se repete**, nem quando o item
excluído é o de maior id (no tempo do JSON ele voltava). O filtro `?nome=` trata `%` e `_`
como texto comum, não como curingas.

**Todos os erros respondem em JSON**, inclusive os gerados pelo Tomcat antes de chegar no
Spring (ex.: `/items/%`) e quando o cliente pede `Accept: text/html`.
Banco fora do ar responde 503 `{"erro":"banco de dados indisponível; veja 'docker logs postgres-lab'"}`
em até ~2s, nunca com stack trace.

## Testes via curl

```bash
B=http://localhost:5050

# health
curl -s $B/health
# {"status":"ok","total":2}

# listar
curl -s $B/items
# {"items":[{"id":1,"nome":"notebook","quantidade":2},{"id":2,"nome":"monitor","quantidade":1}],"total":2}

# filtrar (substring, sem diferenciar maiúsculas)
curl -s "$B/items?nome=MONI"
# {"items":[{"id":2,"nome":"monitor","quantidade":1}],"total":1}

# buscar por id
curl -s $B/items/1
# {"id":1,"nome":"notebook","quantidade":2}

# id inexistente -> 404
curl -s -w ' [%{http_code}]\n' $B/items/999
# {"erro":"item não encontrado","id":999} [404]

# rota inexistente -> 404
curl -s -w ' [%{http_code}]\n' $B/nao-existe
# {"erro":"rota não encontrada"} [404]

# criar -> 201 (o id vem do banco: 3 num banco recém-criado)
curl -s -w ' [%{http_code}]\n' -X POST $B/items \
  -H 'Content-Type: application/json' -d '{"nome":"teclado","quantidade":3}'
# {"id":3,"nome":"teclado","quantidade":3} [201]

# criar sem quantidade -> padrão 1
curl -s -X POST $B/items -H 'Content-Type: application/json' -d '{"nome":"mouse"}'
# {"id":4,"nome":"mouse","quantidade":1}

# body não é JSON -> 400
curl -s -w ' [%{http_code}]\n' -X POST $B/items \
  -H 'Content-Type: application/json' -d 'isto não é json'
# {"erro":"corpo deve ser um JSON válido"} [400]

# body é JSON mas não é objeto -> 400
curl -s -w ' [%{http_code}]\n' -X POST $B/items -H 'Content-Type: application/json' -d '[1,2]'
# {"erro":"corpo deve ser um JSON válido"} [400]

# sem nome -> 422
curl -s -w ' [%{http_code}]\n' -X POST $B/items \
  -H 'Content-Type: application/json' -d '{"quantidade":2}'
# {"erro":"campo 'nome' é obrigatório e deve ser texto"} [422]

# quantidade negativa -> 422
curl -s -w ' [%{http_code}]\n' -X POST $B/items \
  -H 'Content-Type: application/json' -d '{"nome":"x","quantidade":-1}'
# {"erro":"campo 'quantidade' deve ser inteiro >= 0"} [422]

# quantidade como texto -> 422
curl -s -w ' [%{http_code}]\n' -X POST $B/items \
  -H 'Content-Type: application/json' -d '{"nome":"x","quantidade":"3"}'
# {"erro":"campo 'quantidade' deve ser inteiro >= 0"} [422]

# atualizar -> 200
curl -s -w ' [%{http_code}]\n' -X PUT $B/items/3 \
  -H 'Content-Type: application/json' -d '{"nome":"teclado mecânico","quantidade":5}'
# {"id":3,"nome":"teclado mecânico","quantidade":5} [200]

# atualizar id inexistente -> 404
curl -s -w ' [%{http_code}]\n' -X PUT $B/items/999 \
  -H 'Content-Type: application/json' -d '{"nome":"x"}'
# {"erro":"item não encontrado","id":999} [404]

# atualizar com quantidade inválida -> 422
curl -s -w ' [%{http_code}]\n' -X PUT $B/items/3 \
  -H 'Content-Type: application/json' -d '{"nome":"x","quantidade":-1}'
# {"erro":"campo 'quantidade' deve ser inteiro >= 0"} [422]

# excluir -> 204 sem corpo
curl -s -o /dev/null -w '[%{http_code}]\n' -X DELETE $B/items/4
# [204]

# excluir id inexistente -> 404
curl -s -w ' [%{http_code}]\n' -X DELETE $B/items/4
# {"erro":"item não encontrado","id":4} [404]

# a interface
curl -s -o /dev/null -w '[%{http_code} %{content_type}]\n' $B/
# [200 text/html]
```

### Persistência: está no banco, e o banco é compartilhado

```bash
curl -s -X POST $B/items -H 'Content-Type: application/json' \
  -d '{"nome":"sobrevivente","quantidade":7}'
# {"id":5,"nome":"sobrevivente","quantidade":7}   (5: o 4 foi excluído acima e não volta)
docker compose up -d --force-recreate --wait java-lab-api   # recria o container e espera o healthy
curl -s "$B/items?nome=sobrev"
# {"items":[{"id":5,"nome":"sobrevivente","quantidade":7}],"total":1}
curl -s "http://localhost:5000/items?nome=sobrev"   # a API Flask enxerga o mesmo item
docker exec postgres-lab psql -U postgres -d lab -c 'SELECT * FROM items ORDER BY id'
```

### Banco fora do ar não derruba a API

```bash
docker compose stop postgres-lab
curl -s -w ' [%{http_code}]\n' $B/health
# {"detalhe":"banco de dados inacessível: java.net.ConnectException: Connection refused ...","status":"erro"} [503]
curl -s -w ' [%{http_code}]\n' $B/items
# {"erro":"banco de dados indisponível; veja 'docker logs postgres-lab'"} [503]
docker compose start postgres-lab
curl -s $B/health   # volta sozinha, sem restart da API
```

## Problemas comuns no WSL

**`503` com `banco de dados inacessível` / `banco de dados indisponível`**
A API está de pé, mas não alcança o Postgres; o container fica `unhealthy` após ~90s
(3 falhas a cada 30s). O motivo exato está em `docker logs java-lab-api 2>&1 | grep -i banco`:
- `Connection refused`: o banco está fora. `docker compose start postgres-lab`; a API volta sozinha.
- `password authentication failed for user "lab_app"`: a `APP_DB_PASSWORD` do `.env` da raiz não é a
  senha com que o volume do banco foi criado (veja [postgres-lab](../postgres-lab/README.md#problemas-comuns)).

**`defina APP_DB_PASSWORD no .env` no `docker compose up`**
Falta o `.env` da raiz ou a variável (`cp .env.example .env` na raiz e preencha).

**Build falha nos testes com erro do PostgreSQL embutido**
Ele não roda como root: rode o `mvn test` com `-u "$(id -u):$(id -g)"` (o Dockerfile já usa
um usuário comum). A primeira vez baixa o binário do Postgres (~30 MB) pelo Maven.

**Porta 5050 ocupada**
Veja quem está usando com `ss -ltnp | grep 5050` ou `docker ps`. Para trocar, mude
`server.port` em `application.properties`, o `EXPOSE` do Dockerfile e, no compose da raiz, o
mapeamento `ports`, a URL do healthcheck, o `JAVA_URL` do k6 e o target do probe no
`observability/config.alloy`. Depois rode `docker compose up -d --build --wait java-lab-api`.
A `flask-lab-api` usa a 5000, então as duas rodam juntas sem conflito.

**Projeto em `/mnt/c/...` lento ou com permissões estranhas**
Arquivos do Windows montados no WSL não respeitam `chown`/`chmod` direito e o I/O é lento.
Mantenha o projeto no filesystem do Linux (ex.: `~/laboratorios`).

**A tela mostra "Java API offline" ou "Sem conexão com a API"**
O container caiu ou está reiniciando (`docker compose ps`, `docker compose logs java-lab-api`).
A tela mantém os dados que já estavam carregados; o status é verificado a cada 30s.
Se aparecer "offline" com o container de pé, veja se o `/health` dá 503 (banco fora, acima).

**Build lento na primeira vez**
O Maven baixa as dependências uma vez; depois a camada fica em cache enquanto o `pom.xml`
não mudar.
