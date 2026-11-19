// Frontend da API: lista, busca, cria, edita e exclui items. Mesma origem do Flask, sem CORS.
const $ = (sel) => document.querySelector(sel);

const linhas = $("#linhas");
const vazio = $("#vazio");
const contagem = $("#contagem");
const busca = $("#busca");
const form = $("#form-item");
const tituloForm = $("#titulo-form");
const botaoSalvar = $("#botao-salvar");
const botaoCancelar = $("#botao-cancelar");
const botaoEditar = $("#botao-editar");
const botaoExcluir = $("#botao-excluir");
const marcarTodos = $("#marcar-todos");
const mensagem = $("#mensagem");

let itemsVisiveis = [];
const selecionados = new Set(); // ids
let editandoId = null;

async function api(caminho, opcoes) {
  const resp = await fetch(caminho, opcoes);
  const corpo = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, corpo };
}

const json = (method, corpo) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(corpo),
});

// ---------- Lista ----------

function renderizar(items, idDestaque) {
  itemsVisiveis = items;
  // Seleção só vale para o que está na tela
  for (const id of [...selecionados]) {
    if (!items.some((i) => i.id === id)) selecionados.delete(id);
  }

  linhas.replaceChildren(
    ...items.map((item) => {
      const tr = document.createElement("tr");
      tr.dataset.id = item.id;
      if (item.id === idDestaque) tr.classList.add("novo");
      if (selecionados.has(item.id)) tr.classList.add("selecionado");

      const tdSel = document.createElement("td");
      tdSel.className = "sel";
      const caixa = document.createElement("input");
      caixa.type = "checkbox";
      caixa.checked = selecionados.has(item.id);
      caixa.setAttribute("aria-label", `Selecionar ${item.nome}`);
      tdSel.append(caixa);
      tr.append(tdSel);

      for (const [valor, classe] of [[item.id], [item.nome], [item.quantidade, "num"]]) {
        const td = document.createElement("td");
        td.textContent = valor;
        if (classe) td.className = classe;
        tr.append(td);
      }
      return tr;
    })
  );
  vazio.hidden = items.length > 0;
  contagem.textContent = items.length;
  atualizarFerramentas();
}

// "#3" busca por id (GET /items/3); qualquer outro texto filtra por nome.
async function carregar(idDestaque) {
  const termo = busca.value.trim();
  const porId = termo.match(/^#(\d+)$/);

  if (porId) {
    const { ok, corpo } = await api(`/items/${porId[1]}`);
    renderizar(ok ? [corpo] : [], idDestaque);
    return;
  }

  const query = termo ? `?nome=${encodeURIComponent(termo)}` : "";
  const { ok, corpo } = await api(`/items${query}`);
  renderizar(ok ? corpo.items : [], idDestaque);
}

// ---------- Seleção ----------

function alternar(id, marcado) {
  if (marcado) selecionados.add(id);
  else selecionados.delete(id);
  const tr = linhas.querySelector(`tr[data-id="${id}"]`);
  tr.classList.toggle("selecionado", marcado);
  tr.querySelector("input").checked = marcado;
  atualizarFerramentas();
}

function atualizarFerramentas() {
  const n = selecionados.size;
  botaoEditar.disabled = n !== 1;
  botaoEditar.title = n === 1 ? "" : "Selecione exatamente 1 item para editar";
  botaoExcluir.disabled = n === 0;
  desarmar();
  marcarTodos.checked = n > 0 && n === itemsVisiveis.length;
  marcarTodos.indeterminate = n > 0 && n < itemsVisiveis.length;
}

linhas.addEventListener("click", (e) => {
  const tr = e.target.closest("tr");
  if (!tr) return;
  const id = Number(tr.dataset.id);
  // Clique na caixinha já mudou o estado; clique no resto da linha inverte
  const marcado = e.target.matches("input") ? e.target.checked : !selecionados.has(id);
  alternar(id, marcado);
});

marcarTodos.addEventListener("change", () => {
  for (const item of itemsVisiveis) alternar(item.id, marcarTodos.checked);
});

// ---------- Criar / editar (mesmo formulário) ----------

function modoEdicao(item) {
  editandoId = item.id;
  form.nome.value = item.nome;
  form.quantidade.value = item.quantidade;
  tituloForm.textContent = `Editar item #${item.id}`;
  botaoSalvar.textContent = "Salvar";
  botaoCancelar.hidden = false;
  avisar("");
  form.nome.focus();
  form.nome.select();
}

function modoCriacao() {
  editandoId = null;
  form.reset();
  tituloForm.textContent = "Novo item";
  botaoSalvar.textContent = "Adicionar";
  botaoCancelar.hidden = true;
}

botaoEditar.addEventListener("click", () => {
  const [id] = selecionados;
  const item = itemsVisiveis.find((i) => i.id === id);
  if (item) modoEdicao(item);
});

botaoCancelar.addEventListener("click", () => {
  modoCriacao();
  avisar("");
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = form.nome.value.trim();
  const qtd = form.quantidade.value === "" ? 1 : Number(form.quantidade.value);

  form.nome.setAttribute("aria-invalid", String(!nome));
  if (!nome) return avisar("Informe um nome.", true);
  if (!Number.isInteger(qtd) || qtd < 0) return avisar("Quantidade deve ser um inteiro ≥ 0.", true);

  const id = editandoId;
  botaoSalvar.disabled = true;
  try {
    const { ok, corpo } = id
      ? await api(`/items/${id}`, json("PATCH", { nome, quantidade: qtd }))
      : await api("/items", json("POST", { nome, quantidade: qtd }));
    if (!ok) return avisar(corpo.erro || "Não foi possível salvar o item.", true);

    modoCriacao();
    form.nome.focus();
    avisar(id ? `Item #${corpo.id} atualizado.` : `“${corpo.nome}” adicionado com id ${corpo.id}.`);
    if (!id) busca.value = "";
    await carregar(corpo.id);
  } catch {
    avisar("Sem conexão com a API.", true);
  } finally {
    botaoSalvar.disabled = false;
  }
});

// ---------- Excluir (1º clique arma, 2º confirma) ----------

function desarmar() {
  clearTimeout(botaoExcluir.timer);
  botaoExcluir.classList.remove("confirmar");
  const n = selecionados.size;
  botaoExcluir.textContent = n > 1 ? `Excluir (${n})` : "Excluir";
}

botaoExcluir.addEventListener("click", async () => {
  if (!botaoExcluir.classList.contains("confirmar")) {
    botaoExcluir.classList.add("confirmar");
    botaoExcluir.textContent = "Confirmar?";
    botaoExcluir.timer = setTimeout(desarmar, 3000);
    return;
  }

  clearTimeout(botaoExcluir.timer);
  const ids = [...selecionados];
  botaoExcluir.disabled = true;
  try {
    const falhas = [];
    for (const id of ids) {
      const { ok } = await api(`/items/${id}`, { method: "DELETE" });
      if (!ok) falhas.push(id);
    }
    if (ids.includes(editandoId)) modoCriacao();
    selecionados.clear();
    const removidos = ids.length - falhas.length;
    if (falhas.length) {
      avisar(`${removidos} excluído(s); falhou: #${falhas.join(", #")}.`, true);
    } else {
      avisar(removidos === 1 ? "1 item excluído." : `${removidos} itens excluídos.`);
    }
    await carregar();
  } catch {
    avisar("Sem conexão com a API.", true);
    await carregar().catch(() => {});
  }
});

// ---------- Status e busca ----------

function avisar(texto, erro = false) {
  mensagem.textContent = texto;
  mensagem.classList.toggle("erro", erro);
}

async function verificarStatus() {
  const status = $("#status");
  const texto = $("#status-texto");
  try {
    const { ok, corpo } = await api("/health");
    status.className = ok ? "status ok" : "status falha";
    texto.textContent = ok ? "Python API online" : corpo.detalhe || "Python API com erro";
  } catch {
    status.className = "status falha";
    texto.textContent = "Python API offline";
  }
}

let espera;
busca.addEventListener("input", () => {
  clearTimeout(espera);
  espera = setTimeout(carregar, 250);
});

verificarStatus();
carregar();
