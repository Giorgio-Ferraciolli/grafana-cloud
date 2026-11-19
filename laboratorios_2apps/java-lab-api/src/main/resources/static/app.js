"use strict";

// ---------- estado ----------
let items = [];                 // último carregamento bem-sucedido
const selecionados = new Set(); // ids
let editandoId = null;

const $ = (id) => document.getElementById(id);
const el = {
  status: $("status"), statusTexto: $("status-texto"),
  form: $("form-novo"), nome: $("novo-nome"), qtd: $("novo-qtd"),
  adicionar: $("botao-adicionar"), msgNovo: $("msg-novo"),
  contagem: $("contagem"), busca: $("busca"),
  editar: $("botao-editar"), excluir: $("botao-excluir"),
  msgLista: $("msg-lista"), corpo: $("corpo-tabela"), todos: $("check-todos"),
  dialogo: $("dialogo-excluir"), dialogoTexto: $("dialogo-texto"),
};

// ---------- HTTP ----------
/** Faz a chamada e devolve {ok, status, dados}. Erro de rede vira exceção com mensagem amigável. */
async function api(metodo, caminho, corpo) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo !== undefined) {
    opcoes.headers["Content-Type"] = "application/json";
    opcoes.body = JSON.stringify(corpo);
  }
  let resp;
  try {
    resp = await fetch(caminho, opcoes);
  } catch {
    throw new Error("Sem conexão com a API. Os dados exibidos podem estar desatualizados.");
  }
  let dados = null;
  if (resp.status !== 204) {
    try { dados = await resp.json(); } catch { dados = null; }
  }
  return { ok: resp.ok, status: resp.status, dados };
}

const mensagemDeErro = (r) => (r.dados && r.dados.erro) || `Erro inesperado (HTTP ${r.status}).`;

function mostrar(alvo, texto) {
  alvo.textContent = texto || "";
  alvo.hidden = !texto;
}

// ---------- status da API ----------
async function verificarSaude() {
  let online = false;
  try {
    const r = await fetch("/health", { cache: "no-store" });
    online = r.ok;
  } catch {
    online = false;
  }
  el.status.classList.toggle("online", online);
  el.status.classList.toggle("offline", !online);
  el.statusTexto.textContent = online ? "Java API online" : "Java API offline";
}

// ---------- lista ----------
async function carregar() {
  try {
    const r = await api("GET", "/items");
    if (!r.ok) throw new Error(mensagemDeErro(r));
    items = r.dados.items;
    mostrar(el.msgLista, "");
  } catch (e) {
    mostrar(el.msgLista, e.message);   // mantém o que já estava na tela
  }
  render();
}

function filtrados() {
  const termo = el.busca.value.trim();
  if (!termo) return items;
  if (termo.startsWith("#")) {
    const id = termo.slice(1).trim();
    if (!id) return items;
    return items.filter((i) => String(i.id) === id);
  }
  const t = termo.toLowerCase();
  return items.filter((i) => String(i.nome).toLowerCase().includes(t));
}

function render() {
  const visiveis = filtrados();
  const idsVisiveis = new Set(visiveis.map((i) => i.id));

  // não deixa selecionado o que a busca escondeu (evita excluir algo invisível)
  for (const id of [...selecionados]) {
    if (!idsVisiveis.has(id)) selecionados.delete(id);
  }
  if (editandoId !== null && !idsVisiveis.has(editandoId)) editandoId = null;

  el.contagem.textContent = visiveis.length === items.length
    ? String(items.length)
    : `${visiveis.length} de ${items.length}`;

  el.corpo.replaceChildren();
  if (visiveis.length === 0) {
    const tr = document.createElement("tr");
    tr.className = "linha-info";
    const td = document.createElement("td");
    td.colSpan = 4;
    td.textContent = items.length === 0
      ? "Nenhum item cadastrado ainda. Use o formulário acima para adicionar."
      : "Nenhum item corresponde à busca.";
    tr.append(td);
    el.corpo.append(tr);
  } else {
    for (const item of visiveis) {
      el.corpo.append(item.id === editandoId ? linhaEdicao(item) : linhaItem(item));
    }
  }
  atualizarControles(visiveis);
}

function linhaItem(item) {
  const tr = document.createElement("tr");
  const marcado = selecionados.has(item.id);
  tr.className = "item" + (marcado ? " selecionada" : "");
  tr.dataset.id = item.id;
  tr.setAttribute("aria-selected", String(marcado));

  const tdCheck = document.createElement("td");
  tdCheck.className = "col-check";
  const check = document.createElement("input");
  check.type = "checkbox";
  check.checked = marcado;
  check.setAttribute("aria-label", `Selecionar item #${item.id} ${item.nome}`);
  check.addEventListener("change", () => alternar(item.id, check.checked));
  tdCheck.append(check);

  const tdId = document.createElement("td");
  tdId.className = "id";
  tdId.textContent = `#${item.id}`;

  const tdNome = document.createElement("td");
  tdNome.textContent = item.nome;

  const tdQtd = document.createElement("td");
  tdQtd.className = "col-qtd";
  tdQtd.textContent = item.quantidade;

  tr.append(tdCheck, tdId, tdNome, tdQtd);
  // clicar em qualquer lugar da linha seleciona; o checkbox cuida de si mesmo
  tr.addEventListener("click", (e) => {
    if (e.target.closest("input, button")) return;
    alternar(item.id, !selecionados.has(item.id));
  });
  return tr;
}

function linhaEdicao(item) {
  const tr = document.createElement("tr");
  tr.className = "editando";

  const tdCheck = document.createElement("td");
  tdCheck.className = "col-check";

  const tdId = document.createElement("td");
  tdId.className = "id";
  tdId.textContent = `#${item.id}`;

  const tdNome = document.createElement("td");
  const nome = document.createElement("input");
  nome.type = "text";
  nome.value = item.nome;
  nome.id = "editar-nome";
  const lNome = document.createElement("label");
  lNome.htmlFor = nome.id;
  lNome.className = "visualmente-oculto";
  lNome.textContent = `Nome do item #${item.id}`;
  tdNome.append(lNome, nome);

  const tdQtd = document.createElement("td");
  tdQtd.className = "col-qtd";
  const qtd = document.createElement("input");
  qtd.type = "number";
  qtd.min = "0";
  qtd.step = "1";
  qtd.value = item.quantidade;
  qtd.id = "editar-qtd";
  qtd.inputMode = "numeric";
  const lQtd = document.createElement("label");
  lQtd.htmlFor = qtd.id;
  lQtd.className = "visualmente-oculto";
  lQtd.textContent = `Quantidade do item #${item.id}`;

  const acoes = document.createElement("div");
  acoes.className = "editor-acoes";
  const confirmar = document.createElement("button");
  confirmar.type = "button";
  confirmar.className = "botao botao-primario botao-mini";
  confirmar.textContent = "Confirmar";
  const cancelar = document.createElement("button");
  cancelar.type = "button";
  cancelar.className = "botao botao-mini";
  cancelar.textContent = "Cancelar";
  acoes.append(cancelar, confirmar);
  tdQtd.append(lQtd, qtd, acoes);

  const salvar = async () => {
    confirmar.disabled = cancelar.disabled = true;
    try {
      const r = await api("PUT", `/items/${item.id}`, {
        nome: nome.value,
        quantidade: numeroOuTexto(qtd.value),
      });
      if (!r.ok) {
        mostrar(el.msgLista, mensagemDeErro(r));
        if (r.status === 404) { editandoId = null; await carregar(); }
        return;
      }
      editandoId = null;
      mostrar(el.msgLista, "");
      await carregar();
    } catch (e) {
      mostrar(el.msgLista, e.message);
    } finally {
      confirmar.disabled = cancelar.disabled = false;
    }
  };
  const desistir = () => {
    editandoId = null;
    mostrar(el.msgLista, "");
    render();
    el.editar.focus();
  };

  confirmar.addEventListener("click", salvar);
  cancelar.addEventListener("click", desistir);
  for (const campo of [nome, qtd]) {
    campo.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); salvar(); }
      if (e.key === "Escape") { e.preventDefault(); desistir(); }
    });
  }

  tr.append(tdCheck, tdId, tdNome, tdQtd);
  queueMicrotask(() => { nome.focus(); nome.select(); });
  return tr;
}

function alternar(id, marcar) {
  if (editandoId !== null) return;
  if (marcar) selecionados.add(id); else selecionados.delete(id);
  render();
}

function atualizarControles(visiveis) {
  const n = selecionados.size;
  const editando = editandoId !== null;
  el.editar.disabled = editando || n !== 1;
  el.excluir.disabled = editando || n === 0;
  el.excluir.textContent = n > 1 ? `Excluir (${n})` : "Excluir";
  el.todos.disabled = editando || visiveis.length === 0;
  el.todos.checked = visiveis.length > 0 && n === visiveis.length;
  el.todos.indeterminate = n > 0 && n < visiveis.length;
}

/** "3" -> 3; vazio ou não inteiro segue como texto para a API devolver o 422 dela. */
function numeroOuTexto(valor) {
  const v = String(valor).trim();
  return /^-?\d+$/.test(v) ? Number(v) : v;
}

// ---------- eventos ----------
el.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  el.adicionar.disabled = true;
  el.nome.removeAttribute("aria-invalid");
  el.qtd.removeAttribute("aria-invalid");
  try {
    const r = await api("POST", "/items", {
      nome: el.nome.value,
      quantidade: numeroOuTexto(el.qtd.value),
    });
    if (!r.ok) {
      const msg = mensagemDeErro(r);
      mostrar(el.msgNovo, msg);
      const campo = msg.includes("quantidade") ? el.qtd : el.nome;
      campo.setAttribute("aria-invalid", "true");
      campo.focus();
      return;
    }
    mostrar(el.msgNovo, "");
    el.form.reset();          // volta Nome vazio e Quantidade 1
    el.nome.focus();
    await carregar();
  } catch (err) {
    mostrar(el.msgNovo, err.message);
  } finally {
    el.adicionar.disabled = false;
  }
});

el.busca.addEventListener("input", render);

el.todos.addEventListener("change", () => {
  const visiveis = filtrados();
  if (el.todos.checked) visiveis.forEach((i) => selecionados.add(i.id));
  else selecionados.clear();
  render();
});

el.editar.addEventListener("click", () => {
  if (selecionados.size !== 1) return;
  editandoId = [...selecionados][0];
  render();
});

el.excluir.addEventListener("click", () => {
  const n = selecionados.size;
  if (n === 0) return;
  const nomes = items.filter((i) => selecionados.has(i.id)).map((i) => `#${i.id} ${i.nome}`);
  el.dialogoTexto.textContent = n === 1
    ? `Excluir o item ${nomes[0]}? Esta ação não pode ser desfeita.`
    : `Excluir ${n} itens (${nomes.join(", ")})? Esta ação não pode ser desfeita.`;
  el.dialogo.returnValue = "";
  el.dialogo.showModal();
});

el.dialogo.addEventListener("close", async () => {
  if (el.dialogo.returnValue !== "confirmar") { el.excluir.focus(); return; }
  const ids = [...selecionados];
  const falhas = [];
  for (const id of ids) {
    try {
      const r = await api("DELETE", `/items/${id}`);
      // 404 = alguém já excluiu: o objetivo foi atingido
      if (r.ok || r.status === 404) selecionados.delete(id);
      else falhas.push(`#${id}: ${mensagemDeErro(r)}`);
    } catch (e) {
      falhas.push(`#${id}: ${e.message}`);
    }
  }
  mostrar(el.msgLista, falhas.length ? `Não foi possível excluir ${falhas.join(" · ")}` : "");
  await carregar();
  if (falhas.length) mostrar(el.msgLista, `Não foi possível excluir ${falhas.join(" · ")}`);
  el.busca.focus();
});

// ---------- início ----------
verificarSaude();
setInterval(verificarSaude, 30000);
carregar();
