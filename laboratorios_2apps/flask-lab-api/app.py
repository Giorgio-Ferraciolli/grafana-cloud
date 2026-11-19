"""API Flask de laboratório: CRUD em /items, persistindo no PostgreSQL (../postgres-lab)."""

import os

import psycopg
from flask import Flask, jsonify, request
from psycopg.conninfo import make_conninfo
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool, PoolTimeout

app = Flask(__name__)

CONNINFO = make_conninfo(
    host=os.getenv("DB_HOST", "localhost"),
    port=os.getenv("DB_PORT", "5432"),
    dbname=os.getenv("DB_NAME", "lab"),
    user=os.getenv("DB_USER", "lab_app"),
    password=os.getenv("DB_PASSWORD", ""),
    # Aparece no pg_stat_activity e nos logs do Postgres (app=flask-lab-api)
    application_name="flask-lab-api",
    connect_timeout=2,
)

# Uma conexão por thread do gunicorn (--threads 4).
# open(wait=False): a API sobe mesmo com o banco fora; /health dá 503 até ele voltar.
pool = ConnectionPool(
    CONNINFO,
    min_size=1,
    max_size=4,
    timeout=2,  # espera máxima por uma conexão livre
    kwargs={"row_factory": dict_row},
    open=False,
)
pool.open(wait=False)

COLUNAS = "id, nome, quantidade"
BIGINT_MAX = 2**63 - 1  # limite da coluna quantidade


def consultar(sql, params=None, um=False):
    """Executa uma query numa conexão do pool. Commit ao sair do bloco (rollback se der erro)."""
    with pool.connection() as conn:
        cur = conn.execute(sql, params)
        return cur.fetchone() if um else cur.fetchall()


@app.get("/")
def index():
    """Frontend: static/index.html (CSS e JS em /static/)."""
    return app.send_static_file("index.html")


@app.get("/health")
def health():
    """Healthcheck: confirma que a API responde E que o banco está acessível."""
    try:
        total = consultar("SELECT count(*) AS total FROM items", um=True)["total"]
    except psycopg.Error as erro:
        return jsonify(status="erro", detalhe=f"banco de dados inacessível: {erro}"), 503
    return jsonify(status="ok", total=total), 200


@app.get("/items")
def listar_items():
    """Lista os items. Filtro opcional: /items?nome=monitor (trecho do nome, sem diferenciar maiúsculas)"""
    nome = request.args.get("nome")
    if not nome:
        items = consultar(f"SELECT {COLUNAS} FROM items ORDER BY id")
    elif "\x00" in nome:
        items = []  # nenhum nome no banco pode ter \x00
    else:
        # strpos em vez de ILIKE: "%" e "_" no filtro valem como texto, não como curinga
        items = consultar(
            f"SELECT {COLUNAS} FROM items WHERE strpos(lower(nome), lower(%s)) > 0 ORDER BY id",
            (nome,),
        )
    return jsonify(total=len(items), items=items), 200


@app.get("/items/<int:item_id>")
def buscar_item(item_id):
    item = consultar(f"SELECT {COLUNAS} FROM items WHERE id = %s", (item_id,), um=True)
    if item is None:
        return jsonify(erro="item não encontrado", id=item_id), 404
    return jsonify(item), 200


def validar(dados, parcial=False):
    """Valida o body de criação/edição. Devolve (campos, None) ou (None, resposta de erro).

    parcial=True (edição): os dois campos são opcionais, mas pelo menos um é exigido.
    """
    if not isinstance(dados, dict):
        return None, (jsonify(erro="corpo deve ser um JSON válido"), 400)

    campos = {}

    if "nome" in dados or not parcial:
        nome = dados.get("nome")
        if not isinstance(nome, str) or not nome.strip() or "\x00" in nome:
            return None, (jsonify(erro="campo 'nome' é obrigatório e deve ser texto"), 422)
        campos["nome"] = nome.strip()

    if "quantidade" in dados or not parcial:
        quantidade = dados.get("quantidade", 1)
        if (not isinstance(quantidade, int) or isinstance(quantidade, bool)
                or not 0 <= quantidade <= BIGINT_MAX):
            return None, (jsonify(erro="campo 'quantidade' deve ser inteiro >= 0"), 422)
        campos["quantidade"] = quantidade

    if not campos:
        return None, (jsonify(erro="informe 'nome' e/ou 'quantidade'"), 422)

    return campos, None


@app.post("/items")
def criar_item():
    """Cria um item. Body JSON: {"nome": "teclado", "quantidade": 3}. O id vem do banco."""
    campos, erro = validar(request.get_json(silent=True))
    if erro:
        return erro

    item = consultar(
        f"INSERT INTO items (nome, quantidade) VALUES (%(nome)s, %(quantidade)s) RETURNING {COLUNAS}",
        campos,
        um=True,
    )
    return jsonify(item), 201


@app.patch("/items/<int:item_id>")
def editar_item(item_id):
    """Edita nome e/ou quantidade. Body JSON: {"nome": "mouse"} ou {"quantidade": 4}"""
    campos, erro = validar(request.get_json(silent=True), parcial=True)
    if erro:
        return erro

    # Campo não enviado chega como NULL e o COALESCE mantém o valor atual
    item = consultar(
        f"""UPDATE items
               SET nome = COALESCE(%(nome)s, nome),
                   quantidade = COALESCE(%(quantidade)s, quantidade)
             WHERE id = %(id)s
         RETURNING {COLUNAS}""",
        {"nome": campos.get("nome"), "quantidade": campos.get("quantidade"), "id": item_id},
        um=True,
    )
    if item is None:
        return jsonify(erro="item não encontrado", id=item_id), 404
    return jsonify(item), 200


@app.delete("/items/<int:item_id>")
def deletar_item(item_id):
    """Remove um item pelo id e devolve o item removido."""
    item = consultar(f"DELETE FROM items WHERE id = %s RETURNING {COLUNAS}", (item_id,), um=True)
    if item is None:
        return jsonify(erro="item não encontrado", id=item_id), 404
    return jsonify(removido=item), 200


@app.errorhandler(404)
def rota_inexistente(_):
    return jsonify(erro="rota não encontrada"), 404


@app.errorhandler(500)
def erro_interno(_):
    """Mantém a resposta em JSON mesmo quando quebra (o padrão do Flask é HTML)."""
    return jsonify(erro="erro interno; veja 'docker logs flask-lab-api'"), 500


@app.errorhandler(psycopg.OperationalError)
@app.errorhandler(PoolTimeout)
def banco_indisponivel(erro):
    """Banco fora do ar, recusando conexão ou pool sem conexão livre."""
    app.logger.error("banco de dados indisponível: %s", erro)
    return jsonify(erro="banco de dados indisponível; veja 'docker logs postgres-lab'"), 503


if __name__ == "__main__":
    # Só para execução local sem container; no Docker quem sobe é o gunicorn
    app.run(host="0.0.0.0", port=5000, debug=True)
