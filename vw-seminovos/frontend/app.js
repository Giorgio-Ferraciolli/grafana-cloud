/* ============ utilitários ============ */
const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const home = $("home"), page = $("page"), grid = $("grid"), toastEl = $("toast");

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const km = (v) => Number(v).toLocaleString("pt-BR") + " km";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pad = (n) => String(n).padStart(2, "0");
const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtDate = (iso) => String(iso).slice(0, 10).split("-").reverse().join("/");
// o MySQL grava created_at em UTC, sem fuso: acrescentamos "Z" para converter ao horário local
const fmtDateTime = (s) => new Date(String(s).replace(" ", "T") + "Z").toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

const store = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
};

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch("/api" + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const d = data && data.detail;
    const names = { name: "nome", email: "e-mail", phone: "telefone", km: "quilometragem", year: "ano", model: "modelo", condition: "estado" };
    throw new Error(Array.isArray(d)
      ? "Confira: " + [...new Set(d.map((x) => names[x.loc.at(-1)] || x.loc.at(-1)))].join(", ")
      : d || "Não foi possível concluir. Tente novamente.");
  }
  return data;
}

function toast(msg, err = false) {
  toastEl.textContent = msg;
  toastEl.className = "toast show" + (err ? " err" : "");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.className = "toast"), 3500);
}

/* Grafana Faro (faro.js): eventos de negócio e tela atual. Nunca enviar dados pessoais aqui. */
const faroApi = () => (window.GrafanaFaroWebSdk && window.GrafanaFaroWebSdk.faro && window.GrafanaFaroWebSdk.faro.api) || null;
function track(name, attrs = {}) {
  try {
    const api = faroApi();
    if (api) api.pushEvent(name, Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, String(v)])));
  } catch {}
}
function trackView(name) {
  try { const api = faroApi(); if (api) api.setView({ name }); } catch {}
}

const RATE = 0.0149; // juros ao mês (fictício)
const pmt = (pv, n) => (pv <= 0 ? 0 : (pv * RATE) / (1 - Math.pow(1 + RATE, -n)));

/* ============ estado ============ */
let cars = [];
let loadError = false;
let activeCat = "Todos";
let currentRoute = null;
let homeScroll = 0;
let favs = store.get("favs", []);
let cmp = store.get("cmp", []);
let recent = store.get("recent", []);
let profile = store.get("profile", {});

const byId = (id) => cars.find((c) => c.id === Number(id));
const isFav = (id) => favs.includes(id);
const inCmp = (id) => cmp.includes(id);

/* ============ peças de UI ============ */
const img = (c, extra = "") =>
  `<img src="img/${esc(c.image)}" alt="Volkswagen ${esc(c.model)} ${esc(c.version)}" ${extra} onerror="this.onerror=null;this.src='img/placeholder.svg'">`;

const card = (c) => `
  <article class="card" data-id="${c.id}">
    <div class="pic">${img(c, 'loading="lazy"')}
      <span class="tag">${esc(c.category)}</span>
      <button class="heart ${isFav(c.id) ? "on" : ""}" data-fav="${c.id}" aria-label="Favoritar ${esc(c.model)}" title="Favoritar">♥</button>
    </div>
    <div class="info">
      <h3><a href="#/carro/${c.id}">${esc(c.model)}</a></h3>
      <div class="ver">${esc(c.version)}</div>
      <div class="specs"><span>${c.year}</span><span>${km(c.km)}</span><span>${esc(c.fuel)}</span></div>
      <div class="card-foot">
        <div><div class="price">${brl(c.price)}</div><div class="from">ou 60x de ${brl(pmt(c.price * 0.8, 60))}*</div></div>
        <button class="cmp-btn ${inCmp(c.id) ? "on" : ""}" data-cmp="${c.id}">${inCmp(c.id) ? "✓ Comparando" : "+ Comparar"}</button>
      </div>
    </div>
  </article>`;

const carOptions = (sel) =>
  cars.map((c) => `<option value="${c.id}" ${c.id === Number(sel) ? "selected" : ""}>${esc(c.model)} ${esc(c.version)} · ${brl(c.price)}</option>`).join("");

const success = (title, text, extra = "") =>
  `<div class="success"><div class="check">✓</div><h4>${title}</h4><p>${text}</p>${extra}</div>`;

const contactFields = () => `
  <div class="row2">
    <input name="name" placeholder="Seu nome" required minlength="2" maxlength="100" autocomplete="name">
    <input name="phone" type="tel" placeholder="Telefone com DDD" required minlength="8" maxlength="30" autocomplete="tel">
  </div>
  <input name="email" type="email" placeholder="E-mail" required autocomplete="email">`;

function prefill(form) {
  ["name", "email", "phone"].forEach((k) => { if (form.elements[k] && profile[k]) form.elements[k].value = profile[k]; });
}

function remember(data) {
  profile = { name: data.name, email: data.email, phone: data.phone };
  store.set("profile", profile);
}

// envio de formulário com botão travado durante a requisição e erro em toast
function onSubmit(form, handler) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = form.querySelector("[type=submit]");
    btn.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(form)));
    } catch (err) {
      toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  });
}

/* ============ favoritos e comparação ============ */
function toggleFav(id) {
  const on = !isFav(id);
  favs = on ? [...favs, id] : favs.filter((f) => f !== id);
  store.set("favs", favs);
  $$(`[data-fav="${id}"]`).forEach((b) => {
    b.classList.toggle("on", on);
    if ("label" in b.dataset) b.textContent = on ? "♥ Favoritado" : "♡ Favoritar";
  });
  syncBadges();
  track("favorite_toggled", { car_id: id, on });
  toast(on ? "Adicionado aos favoritos" : "Removido dos favoritos");
  if (currentRoute === "favoritos") route();
}

function setCmp(list) {
  cmp = list;
  store.set("cmp", cmp);
  $$("[data-cmp]").forEach((b) => {
    if (b.closest("#tray")) return;
    const on = inCmp(Number(b.dataset.cmp));
    b.classList.toggle("on", on);
    b.textContent = on ? "✓ Comparando" : "+ Comparar";
  });
  renderTray();
}

function toggleCmp(id) {
  if (inCmp(id)) return setCmp(cmp.filter((x) => x !== id));
  if (cmp.length >= 3) return toast("Você pode comparar até 3 carros por vez.", true);
  setCmp([...cmp, id]);
}

function renderTray() {
  const list = cmp.map(byId).filter(Boolean);
  // a barra só aparece nas telas de navegação pelo estoque
  $("tray").hidden = !list.length || !["", "carro", "favoritos"].includes(currentRoute);
  $("tray-items").innerHTML = list.map((c) =>
    `<span class="tray-item">${img(c)}<b>${esc(c.model)}</b><button data-cmp="${c.id}" aria-label="Remover ${esc(c.model)}">×</button></span>`).join("");
  const go = $("tray-go");
  go.textContent = list.length < 2 ? "Escolha mais 1" : `Comparar ${list.length}`;
  go.classList.toggle("disabled", list.length < 2);
  go.href = `#/comparar/${cmp.join(",")}`;
}

function syncBadges() {
  $("fav-count").textContent = favs.length;
  $("fav-count").hidden = !favs.length;
}

/* ============ página inicial ============ */
function initHome() {
  const cats = [...new Set(cars.map((c) => c.category))];
  $("f-fuel").innerHTML = '<option value="">Todo combustível</option>' +
    [...new Set(cars.map((c) => c.fuel))].sort().map((f) => `<option>${esc(f)}</option>`).join("");
  $("hero-stats").innerHTML = `
    <div><strong>${cars.length}</strong><span>carros em estoque</span></div>
    <div><strong>${brl(Math.min(...cars.map((c) => c.price)))}</strong><span>a partir de</span></div>
    <div><strong>${cats.length}</strong><span>categorias</span></div>`;
  renderChips();
}

function renderChips() {
  const cats = ["Todos", ...new Set(cars.map((c) => c.category))];
  $("filters").innerHTML = cats.map((c) => `<button class="chip ${c === activeCat ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

function renderGrid() {
  const q = $("search").value.trim().toLowerCase();
  const fuel = $("f-fuel").value;
  const max = Number($("f-price").value) || Infinity;
  const [key, dir] = $("sort").value.split("-");
  const list = cars
    .filter((c) => activeCat === "Todos" || c.category === activeCat)
    .filter((c) => !fuel || c.fuel === fuel)
    .filter((c) => c.price <= max)
    .filter((c) => !q || `${c.model} ${c.version} ${c.color} ${c.category}`.toLowerCase().includes(q))
    .sort((a, b) => (dir === "asc" ? a[key] - b[key] : b[key] - a[key]));
  const filtered = q || fuel || $("f-price").value || activeCat !== "Todos";
  $("count").textContent = `${list.length} ${list.length === 1 ? "veículo encontrado" : "veículos encontrados"}`;
  $("clear").hidden = !filtered;
  grid.innerHTML = list.length
    ? list.map(card).join("")
    : '<div class="empty">Nenhum veículo com esses filtros.<button class="chip" data-clear>Limpar filtros</button></div>';
}

function clearFilters() {
  $("search").value = "";
  $("f-fuel").value = "";
  $("f-price").value = "";
  activeCat = "Todos";
  renderChips();
  renderGrid();
}

function renderRecent() {
  const list = recent.map(byId).filter(Boolean);
  $("recent").hidden = !list.length;
  $("recent-grid").innerHTML = list.map(card).join("");
}

/* ============ detalhe do carro ============ */
function viewCar([id]) {
  const c = byId(id);
  if (!c) return viewNotFound("Esse veículo não está mais no estoque.");
  const similar = cars
    .filter((x) => x.id !== c.id)
    .sort((a, b) => (a.category !== c.category) - (b.category !== c.category) || Math.abs(a.price - c.price) - Math.abs(b.price - c.price))
    .slice(0, 3);
  return {
    title: `${c.model} ${c.version}`,
    html: `
      <a class="back" href="#/">← Voltar ao estoque</a>
      <section class="detail">
        <div class="detail-pic">${img(c)}</div>
        <div class="body">
          <span class="tag static">${esc(c.category)}</span>
          <h1 class="model">${esc(c.model)}</h1>
          <div class="ver">${esc(c.version)}</div>
          <div class="price big">${brl(c.price)}</div>
          <div class="from">ou 60x de ${brl(pmt(c.price * 0.8, 60))} com 20% de entrada*</div>
          <div class="table">
            <div><small>Ano</small>${c.year}</div>
            <div><small>Quilometragem</small>${km(c.km)}</div>
            <div><small>Motor</small>${esc(c.engine)}</div>
            <div><small>Câmbio</small>${esc(c.transmission)}</div>
            <div><small>Cor</small>${esc(c.color)}</div>
            <div><small>Combustível</small>${esc(c.fuel)}</div>
          </div>
          <p class="desc">${esc(c.description)}</p>
          <div class="actions">
            <button class="chip ${isFav(c.id) ? "on" : ""}" data-fav="${c.id}" data-label>${isFav(c.id) ? "♥ Favoritado" : "♡ Favoritar"}</button>
            <button class="chip ${inCmp(c.id) ? "on" : ""}" data-cmp="${c.id}">${inCmp(c.id) ? "✓ Comparando" : "+ Comparar"}</button>
            <a class="chip" href="#/simulador/${c.id}">Simular financiamento</a>
            <button class="chip" id="share">Copiar link</button>
          </div>
        </div>
      </section>

      <section class="split">
        <div class="panel">
          <div class="tabs" role="tablist">
            <button class="tab on" data-tab="lead" role="tab">Fazer proposta</button>
            <button class="tab" data-tab="td" role="tab">Agendar test drive</button>
          </div>
          <div data-pane="lead">
            <form id="lead-form" class="form">
              ${contactFields()}
              <textarea name="message" rows="3" maxlength="1000" placeholder="Mensagem (opcional)">Olá! Tenho interesse no ${esc(c.model)} ${esc(c.version)} ${c.year}.</textarea>
              <button class="btn" type="submit">Enviar proposta</button>
            </form>
          </div>
          <div data-pane="td" hidden>
            <form id="td-form" class="form">
              <label class="field">Escolha o dia<input type="date" id="td-date" required></label>
              <div class="field">Horário<div class="slots" id="td-slots"></div></div>
              ${contactFields()}
              <button class="btn" type="submit">Agendar test drive</button>
            </form>
          </div>
        </div>
        <aside class="panel why">
          <h4>Por que comprar aqui</h4>
          <ul>
            <li>Laudo cautelar aprovado</li>
            <li>Garantia de 12 meses</li>
            <li>Revisão de 120 itens</li>
            <li>Documentação inclusa</li>
          </ul>
          <a class="btn ghost small" href="#/vender">Use seu usado na troca</a>
        </aside>
      </section>

      <h2 class="section-title">Você também pode gostar</h2>
      <div class="grid">${similar.map(card).join("")}</div>
      <p class="note">* Simulação com taxa fictícia de ${(RATE * 100).toFixed(2).replace(".", ",")}% a.m. Sujeita a análise de crédito.</p>`,
    mount: () => mountCar(c),
  };
}

function mountCar(c) {
  recent = [c.id, ...recent.filter((x) => x !== c.id)].slice(0, 4);
  store.set("recent", recent);
  track("car_viewed", { car_id: c.id, model: c.model, price: c.price });

  $$(".tab", page).forEach((t) => t.addEventListener("click", () => {
    $$(".tab", page).forEach((x) => x.classList.toggle("on", x === t));
    $$("[data-pane]", page).forEach((p) => (p.hidden = p.dataset.pane !== t.dataset.tab));
  }));

  $("share").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(location.href); toast("Link copiado!"); }
    catch { toast("Copie o link pela barra de endereço.", true); }
  });

  // proposta
  const lead = $("lead-form");
  prefill(lead);
  onSubmit(lead, async (data) => {
    const r = await api("/leads", { method: "POST", body: { ...data, car_id: c.id, message: data.message || null } });
    remember(data);
    track("lead_sent", { car_id: c.id, model: c.model, lead_id: r.id });
    lead.outerHTML = success("Proposta enviada!", `Protocolo #${r.id}. Um consultor vai falar com você em até 1 dia útil.`);
  });

  // test drive
  const td = $("td-form"), dateEl = $("td-date"), slotsEl = $("td-slots");
  prefill(td);
  const start = new Date();
  if (start.getHours() >= 17 || start.getDay() === 0) start.setDate(start.getDate() + 1);
  if (start.getDay() === 0) start.setDate(start.getDate() + 1);
  const max = new Date(); max.setDate(max.getDate() + 30);
  dateEl.min = isoDate(new Date());
  dateEl.max = isoDate(max);
  dateEl.value = isoDate(start);
  let time = null;

  async function loadSlots() {
    time = null;
    if (!dateEl.value) return (slotsEl.innerHTML = '<span class="muted">Escolha uma data.</span>');
    slotsEl.innerHTML = '<span class="muted">Carregando horários…</span>';
    try {
      const r = await api(`/test-drives/slots?car_id=${c.id}&date=${dateEl.value}`);
      slotsEl.innerHTML = r.slots.map((s) =>
        `<button type="button" class="slot" data-time="${s.time}" ${s.available ? "" : "disabled"}>${s.time}</button>`).join("") +
        (r.message ? `<span class="muted">${esc(r.message)}</span>` : "");
    } catch (err) {
      slotsEl.innerHTML = `<span class="muted">${esc(err.message)}</span>`;
    }
  }
  dateEl.addEventListener("change", loadSlots);
  slotsEl.addEventListener("click", (e) => {
    const b = e.target.closest(".slot");
    if (!b || b.disabled) return;
    time = b.dataset.time;
    $$(".slot", slotsEl).forEach((x) => x.classList.toggle("on", x === b));
  });
  onSubmit(td, async (data) => {
    if (!time) throw new Error("Escolha um horário disponível.");
    try {
      const r = await api("/test-drives", { method: "POST", body: { ...data, car_id: c.id, visit_date: dateEl.value, visit_time: time } });
      remember(data);
      track("test_drive_booked", { car_id: c.id, model: c.model, test_drive_id: r.id });
      td.outerHTML = success("Test drive agendado!",
        `Te esperamos em ${fmtDate(dateEl.value)} às ${time} para dirigir o ${esc(c.model)}. Protocolo #${r.id}.`);
    } catch (err) {
      loadSlots();
      throw err;
    }
  });
  loadSlots();
}

/* ============ simulador ============ */
function viewSim([id]) {
  const c = byId(id) || cars[0];
  return {
    title: "Simulador de financiamento",
    html: `
      <h1 class="page-title">Simulador de financiamento</h1>
      <p class="sub">Ajuste a entrada e o prazo para ver a parcela. Taxa fictícia de ${(RATE * 100).toFixed(2).replace(".", ",")}% ao mês.</p>
      <div class="two-col">
        <div class="panel sim">
          <div id="sim-pic" class="sim-pic"></div>
          <label class="field">Veículo<select id="sim-car">${carOptions(c.id)}</select></label>
          <label class="field">Entrada <b id="sim-down-l"></b><input id="sim-down" type="range" min="0" max="90" step="5" value="20"></label>
          <div class="field">Prazo<div class="filters" id="sim-n">${[12, 24, 36, 48, 60].map((n) =>
            `<button type="button" class="chip ${n === 48 ? "active" : ""}" data-n="${n}">${n}x</button>`).join("")}</div></div>
        </div>
        <div class="panel">
          <div class="result" id="sim-out"></div>
          <form id="sim-form" class="form">
            <h4>Gostou? Envie essa simulação para um consultor</h4>
            ${contactFields()}
            <button class="btn" type="submit">Enviar simulação</button>
          </form>
        </div>
      </div>`,
    mount: mountSim,
  };
}

function mountSim() {
  const carEl = $("sim-car"), downEl = $("sim-down"), nEl = $("sim-n");
  let sim;
  function update() {
    const c = byId(carEl.value);
    const pct = Number(downEl.value);
    const n = Number(nEl.querySelector(".active").dataset.n);
    const down = (c.price * pct) / 100, fin = c.price - down, p = pmt(fin, n);
    sim = { c, pct, n, down, p, total: down + p * n };
    history.replaceState(null, "", `#/simulador/${c.id}`);
    $("sim-pic").innerHTML = `${img(c)}<div><b>${esc(c.model)}</b> ${esc(c.version)}<br><span class="muted">${c.year} · ${km(c.km)}</span></div>`;
    $("sim-down-l").textContent = `${pct}% · ${brl(down)}`;
    $("sim-out").innerHTML = `
      <div class="main"><small>Parcela mensal</small><strong>${n}x de ${brl(p)}</strong></div>
      <div><small>Preço do veículo</small>${brl(c.price)}</div>
      <div><small>Valor financiado</small>${brl(fin)}</div>
      <div><small>Juros totais</small>${brl(p * n - fin)}</div>
      <div><small>Total pago</small>${brl(sim.total)}</div>
      <a class="link" href="#/carro/${c.id}">Ver detalhes do ${esc(c.model)} →</a>`;
  }
  carEl.addEventListener("change", update);
  downEl.addEventListener("input", update);
  nEl.addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    $$(".chip", nEl).forEach((x) => x.classList.toggle("active", x === b));
    update();
  });
  update();

  const form = $("sim-form");
  prefill(form);
  onSubmit(form, async (data) => {
    const { c, pct, n, down, p, total } = sim;
    const message = `Simulação: ${c.model} ${c.version}, entrada de ${brl(down)} (${pct}%), ${n}x de ${brl(p)}, total ${brl(total)}.`;
    const r = await api("/leads", { method: "POST", body: { ...data, car_id: c.id, message } });
    remember(data);
    track("simulation_sent", { car_id: c.id, model: c.model, months: n, down_pct: pct });
    form.outerHTML = success("Simulação enviada!", `Protocolo #${r.id}. Um consultor vai retornar com a aprovação de crédito.`);
  });
}

/* ============ comparar ============ */
let cmpPage = [];

function viewCompare([ids]) {
  let list = [...new Set(String(ids || "").split(",").map(Number).filter(byId))];
  for (const id of [...cmp, ...cars.map((c) => c.id)]) {
    if (list.length >= 2) break;
    if (!list.includes(id) && byId(id)) list.push(id);
  }
  cmpPage = list.slice(0, 3);
  return {
    title: "Comparar veículos",
    html: `
      <h1 class="page-title">Comparar veículos</h1>
      <p class="sub">Compare até 3 carros. O melhor valor de cada linha fica em verde.</p>
      <div class="table-wrap"><table class="cmp" id="cmp"></table></div>`,
    mount: () => {
      renderCompare();
      $("cmp").addEventListener("change", (e) => {
        const i = Number(e.target.dataset.slot);
        const id = Number(e.target.value);
        if (!id) return;
        if (cmpPage.includes(id)) { toast("Esse carro já está na comparação.", true); return renderCompare(); }
        if (i >= cmpPage.length) cmpPage.push(id); else cmpPage[i] = id;
        renderCompare();
      });
      $("cmp").addEventListener("click", (e) => {
        const b = e.target.closest("[data-remove]");
        if (!b) return;
        cmpPage.splice(Number(b.dataset.remove), 1);
        renderCompare();
      });
    },
  };
}

function renderCompare() {
  setCmp([...cmpPage]);
  history.replaceState(null, "", `#/comparar/${cmpPage.join(",")}`);
  const cs = cmpPage.map(byId);
  const rows = [
    ["Preço", (c) => brl(c.price), (c) => c.price, "low"],
    ["Parcela 60x*", (c) => brl(pmt(c.price * 0.8, 60))],
    ["Ano", (c) => c.year, (c) => c.year, "high"],
    ["Quilometragem", (c) => km(c.km), (c) => c.km, "low"],
    ["Categoria", (c) => esc(c.category)],
    ["Combustível", (c) => esc(c.fuel)],
    ["Motor", (c) => esc(c.engine)],
    ["Câmbio", (c) => esc(c.transmission)],
    ["Cor", (c) => esc(c.color)],
  ];
  const head = cs.map((c, i) => `
    <th>
      <div class="cmp-head">
        ${cs.length > 2 ? `<button class="x" data-remove="${i}" aria-label="Remover">×</button>` : ""}
        <a href="#/carro/${c.id}">${img(c)}</a>
        <select data-slot="${i}" aria-label="Trocar carro">${carOptions(c.id)}</select>
      </div>
    </th>`).join("");
  const add = cs.length < 3
    ? `<th class="add"><div class="cmp-head"><div class="add-box">+</div>
        <select data-slot="${cs.length}" aria-label="Adicionar carro"><option value="">Adicionar carro…</option>${carOptions()}</select></div></th>`
    : "";
  const body = rows.map(([label, show, val, best]) => {
    let win = null;
    if (best) {
      const vals = cs.map(val);
      const target = best === "low" ? Math.min(...vals) : Math.max(...vals);
      if (new Set(vals).size > 1) win = target;
    }
    return `<tr><td class="lbl">${label}</td>${cs.map((c) =>
      `<td class="${win !== null && val(c) === win ? "win" : ""}">${show(c)}</td>`).join("")}${add ? "<td></td>" : ""}</tr>`;
  }).join("");
  const cta = `<tr><td class="lbl"></td>${cs.map((c) => `<td><a class="btn small" href="#/carro/${c.id}">Ver carro</a></td>`).join("")}${add ? "<td></td>" : ""}</tr>`;
  $("cmp").innerHTML = `<thead><tr><th></th>${head}${add}</tr></thead><tbody>${body}${cta}</tbody>`;
}

/* ============ favoritos ============ */
function viewFavs() {
  const list = cars.filter((c) => isFav(c.id));
  return {
    title: "Favoritos",
    html: `
      <div class="page-head">
        <div><h1 class="page-title">Meus favoritos</h1><p class="sub">Salvos neste navegador.</p></div>
        ${list.length >= 2 ? '<button class="btn ghost small" id="fav-cmp">Comparar favoritos</button>' : ""}
      </div>
      <div class="grid">${list.length ? list.map(card).join("")
        : '<div class="empty">Você ainda não favoritou nenhum carro. Toque no ♥ de um carro no estoque.<a class="chip" href="#/">Ver estoque</a></div>'}</div>`,
    mount: () => {
      const b = $("fav-cmp");
      if (b) b.addEventListener("click", () => { location.hash = `#/comparar/${list.slice(0, 3).map((c) => c.id).join(",")}`; });
    },
  };
}

/* ============ vender meu carro ============ */
function viewSell() {
  const year = new Date().getFullYear();
  const years = Array.from({ length: year - 2004 }, (_, i) => year + 1 - i);
  return {
    title: "Vender meu carro",
    html: `
      <h1 class="page-title">Venda ou troque seu carro</h1>
      <p class="sub">Receba uma estimativa na hora e agende a avaliação presencial. Sem compromisso.</p>
      <ol class="steps"><li class="on" data-step="1">Seu carro</li><li data-step="2">Estimativa</li><li data-step="3">Contato</li></ol>
      <div class="two-col">
        <form id="eval-form" class="panel form">
          <label class="field">Modelo<select name="model" id="eval-model" required><option value="">Carregando modelos…</option></select></label>
          <div class="row2">
            <label class="field">Ano<select name="year" required>${years.map((y) => `<option ${y === year - 3 ? "selected" : ""}>${y}</option>`).join("")}</select></label>
            <label class="field">Quilometragem<input name="km" type="number" min="0" max="999999" required placeholder="Ex.: 45000"></label>
          </div>
          <div class="field">Estado de conservação
            <div class="filters">
              ${[["excelente", "Excelente"], ["bom", "Bom"], ["regular", "Regular"]].map(([v, l]) =>
                `<label class="chip radio"><input type="radio" name="condition" value="${v}" ${v === "bom" ? "checked" : ""}> ${l}</label>`).join("")}
            </div>
          </div>
          <button class="btn" type="submit">Calcular estimativa</button>
        </form>
        <div class="panel" id="eval-out">
          <div class="placeholder">Preencha os dados do seu carro para ver quanto pagamos por ele.</div>
        </div>
      </div>`,
    mount: mountSell,
  };
}

function mountSell() {
  const steps = (n) => $$(".steps li", page).forEach((li) => li.classList.toggle("on", Number(li.dataset.step) <= n));
  api("/valuation/models")
    .then((models) => {
      $("eval-model").innerHTML = '<option value="">Selecione o modelo</option>' + models.map((m) => `<option>${esc(m)}</option>`).join("");
    })
    .catch(() => toast("Não foi possível carregar os modelos.", true));

  onSubmit($("eval-form"), async (data) => {
    const car = { model: data.model, year: Number(data.year), km: Number(data.km), condition: data.condition };
    const r = await api("/valuation", { method: "POST", body: car });
    track("valuation_calculated", { model: car.model, year: car.year, estimate: r.estimate });
    steps(2);
    const out = $("eval-out");
    out.innerHTML = `
      <div class="estimate">
        <small>Estimativa para ${esc(car.model)} ${car.year} · ${km(car.km)}</small>
        <strong>${brl(r.min)} a ${brl(r.max)}</strong>
        <span class="muted">Valor final confirmado na avaliação presencial.</span>
      </div>
      <form id="sell-form" class="form">
        <h4>Quero vender por esse valor</h4>
        ${contactFields()}
        <button class="btn" type="submit">Agendar avaliação</button>
      </form>`;
    out.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const form = $("sell-form");
    prefill(form);
    form.addEventListener("input", () => steps(3), { once: true });
    onSubmit(form, async (contact) => {
      const s = await api("/sell-requests", { method: "POST", body: { ...car, ...contact } });
      remember(contact);
      track("sell_request_sent", { model: car.model, year: car.year, sell_request_id: s.id });
      steps(3);
      form.outerHTML = success("Avaliação solicitada!", `Protocolo #${s.id}. Vamos ligar para combinar o melhor horário.`,
        '<a class="chip" href="#/">Ver carros para a troca</a>');
    });
  });
}

/* ============ painel ============ */
const ADMIN_TABS = {
  leads: {
    label: "Propostas", path: "/leads", table: "leads",
    cols: [
      ["Recebida", (r) => fmtDateTime(r.created_at)],
      ["Cliente", (r) => `${esc(r.name)}<small>${esc(r.email)} · ${esc(r.phone)}</small>`],
      ["Veículo", (r) => `<a class="link" href="#/carro/${r.car_id}">${esc(r.model)}</a><small>${esc(r.version)}</small>`],
      ["Mensagem", (r) => `<span class="msg">${esc(r.message || "—")}</span>`],
    ],
  },
  "test-drives": {
    label: "Test drives", path: "/test-drives", table: "test_drives",
    cols: [
      ["Quando", (r) => `<b>${fmtDate(r.visit_date)}</b> às ${esc(r.visit_time)}`],
      ["Cliente", (r) => `${esc(r.name)}<small>${esc(r.email)} · ${esc(r.phone)}</small>`],
      ["Veículo", (r) => `<a class="link" href="#/carro/${r.car_id}">${esc(r.model)}</a><small>${esc(r.version)}</small>`],
    ],
  },
  "sell-requests": {
    label: "Avaliações", path: "/sell-requests", table: "sell_requests",
    cols: [
      ["Recebida", (r) => fmtDateTime(r.created_at)],
      ["Cliente", (r) => `${esc(r.name)}<small>${esc(r.email)} · ${esc(r.phone)}</small>`],
      ["Carro", (r) => `${esc(r.model)} ${r.year}<small>${km(r.km)} · ${esc(r.car_condition)}</small>`],
      ["Estimativa", (r) => brl(r.estimate)],
    ],
  },
};
let adminTab = "leads";
let statuses = null;

function viewPanel() {
  return {
    title: "Painel",
    html: `
      <div class="page-head">
        <div><h1 class="page-title">Painel da loja</h1><p class="sub">Propostas, test drives e avaliações recebidos pelo site. Área sem login, só para o laboratório.</p></div>
        <button class="chip" id="refresh">↻ Atualizar</button>
      </div>
      <div class="stats" id="stats"></div>
      <div class="admin-bar">
        <div class="tabs">${Object.entries(ADMIN_TABS).map(([k, t]) => `<button class="tab ${k === adminTab ? "on" : ""}" data-admin="${k}">${t.label}</button>`).join("")}</div>
        <select id="status-filter" aria-label="Filtrar por status"></select>
      </div>
      <div class="table-wrap"><table class="admin" id="admin"></table></div>`,
    mount: mountPanel,
  };
}

async function loadStats() {
  try {
    const s = await api("/stats");
    $("stats").innerHTML = `
      <div><small>Carros em estoque</small><strong>${s.cars}</strong><span>média ${brl(s.avg_price)}</span></div>
      <div><small>Propostas novas</small><strong>${s.new_leads}</strong><span>aguardando contato</span></div>
      <div><small>Test drives agendados</small><strong>${s.upcoming_test_drives}</strong><span>a partir de hoje</span></div>
      <div><small>Avaliações novas</small><strong>${s.new_sell_requests}</strong><span>carros para comprar</span></div>
      <div class="top"><small>Mais procurados</small>${s.top_cars.length
        ? `<ol>${s.top_cars.map((c) => `<li><a href="#/carro/${c.id}">${esc(c.model)} ${esc(c.version)}</a><b>${c.leads}</b></li>`).join("")}</ol>`
        : '<span>Nenhuma proposta ainda.</span>'}</div>`;
  } catch (err) {
    $("stats").innerHTML = `<p class="status">${esc(err.message)}</p>`;
  }
}

async function loadAdminTable() {
  const tab = ADMIN_TABS[adminTab];
  const opts = statuses[tab.table];
  const filter = $("status-filter");
  const keep = opts.includes(filter.value) ? filter.value : "";
  filter.innerHTML = '<option value="">Todos os status</option>' + opts.map((s) => `<option ${s === keep ? "selected" : ""}>${s}</option>`).join("");
  const table = $("admin");
  table.innerHTML = '<tbody><tr><td class="muted">Carregando…</td></tr></tbody>';
  try {
    const rows = await api(tab.path + (keep ? `?status=${encodeURIComponent(keep)}` : ""));
    if (!rows.length) {
      table.innerHTML = '<tbody><tr><td class="muted">Nada por aqui ainda.</td></tr></tbody>';
      return;
    }
    table.innerHTML = `
      <thead><tr><th>#</th>${tab.cols.map(([h]) => `<th>${h}</th>`).join("")}<th>Status</th></tr></thead>
      <tbody>${rows.map((r) => `
        <tr><td class="muted">${r.id}</td>${tab.cols.map(([, f]) => `<td>${f(r)}</td>`).join("")}
          <td><select class="status-sel st-${esc(r.status).replace(" ", "-")}" data-id="${r.id}">${opts.map((s) =>
            `<option ${s === r.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")}
      </tbody>`;
  } catch (err) {
    table.innerHTML = `<tbody><tr><td class="muted">${esc(err.message)}</td></tr></tbody>`;
  }
}

async function mountPanel() {
  loadStats();
  try {
    statuses = statuses || (await api("/statuses"));
  } catch (err) {
    $("admin").innerHTML = `<tbody><tr><td class="muted">${esc(err.message)}</td></tr></tbody>`;
    return;
  }
  loadAdminTable();
  $$("[data-admin]", page).forEach((b) => b.addEventListener("click", () => {
    adminTab = b.dataset.admin;
    $$("[data-admin]", page).forEach((x) => x.classList.toggle("on", x === b));
    $("status-filter").value = "";
    loadAdminTable();
  }));
  $("status-filter").addEventListener("change", loadAdminTable);
  $("refresh").addEventListener("click", () => { loadStats(); loadAdminTable(); toast("Dados atualizados"); });
  $("admin").addEventListener("change", async (e) => {
    const sel = e.target.closest(".status-sel");
    if (!sel) return;
    sel.disabled = true;
    try {
      await api(`${ADMIN_TABS[adminTab].path}/${sel.dataset.id}`, { method: "PATCH", body: { status: sel.value } });
      sel.className = `status-sel st-${sel.value.replace(" ", "-")}`;
      toast(`Registro #${sel.dataset.id} marcado como "${sel.value}"`);
      loadStats();
    } catch (err) {
      toast(err.message, true);
      loadAdminTable();
    } finally {
      sel.disabled = false;
    }
  });
}

/* ============ créditos e 404 ============ */
const CREDITS = [
  ["Nivus (Taigo)", "Alexander Migl", "CC BY-SA 4.0", "File:Volkswagen_Taigo_1X7A0246.jpg"],
  ["T-Cross", "Alexander-93", "CC BY-SA 4.0", "File:Volkswagen_T-Cross_(2023)_1X7A1967.jpg"],
  ["Jetta GLI", "Alexander Migl", "CC BY-SA 4.0", "File:2025_Volkswagen_Jetta_VII_GLI_DSC_7774.jpg"],
  ["Saveiro", "Just a Man", "CC BY 4.0", "File:2024_Volkswagen_Saveiro_1.6_MSi_Trendline_(front).jpg"],
  ["Amarok", "Just a Man", "CC BY 4.0", "File:2023_Volkswagen_Amarok_Extreme_V6_4X4.jpg"],
  ["Tiguan Allspace", "Alexander Migl", "CC BY-SA 4.0", "File:Volkswagen_Tiguan_Allspace_FL_1X7A0302.jpg"],
  ["Golf GTI", "Damian B Oh", "CC BY-SA 4.0", "File:Volkswagen_Golf_GTI_Mk8_Dolphin_Gray_Metallic_(2).jpg"],
  ["ID.4", "Alexander Migl", "CC BY-SA 4.0", "File:Volkswagen_ID.4_1X7A0360.jpg"],
  ["Polo Track", "Just a Man", "CC BY 4.0", "File:2024_Volkswagen_Polo_Track_1.6.jpg"],
];

function viewCredits() {
  return {
    title: "Créditos",
    html: `
      <h1 class="page-title">Créditos das fotos</h1>
      <p class="sub">Fotos do Wikimedia Commons, redimensionadas e usadas conforme as licenças abaixo.</p>
      <div class="table-wrap"><table class="admin">
        <thead><tr><th>Modelo</th><th>Autor</th><th>Licença</th><th>Fonte</th></tr></thead>
        <tbody>${CREDITS.map(([m, a, l, f]) => `<tr><td>${m}</td><td>${a}</td><td>${l}</td>
          <td><a class="link" href="https://commons.wikimedia.org/wiki/${encodeURI(f)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a></td></tr>`).join("")}</tbody>
      </table></div>`,
  };
}

function viewNotFound(msg = "Essa página não existe.") {
  return {
    title: "Não encontrado",
    html: `<div class="empty big"><h1 class="page-title">Ops!</h1><p>${esc(msg)}</p><a class="btn" href="#/">Voltar ao estoque</a></div>`,
  };
}

/* ============ roteador ============ */
const routes = { carro: viewCar, simulador: viewSim, comparar: viewCompare, favoritos: viewFavs, vender: viewSell, painel: viewPanel, creditos: viewCredits };

function route() {
  let [name = "", ...args] = location.hash.replace(/^#\/?/, "").split("/");
  const anchor = ["estoque", "sobre"].includes(name) ? name : null; // links antigos #estoque e #sobre
  if (anchor) name = "";
  if (currentRoute === "") homeScroll = window.scrollY;
  const prev = currentRoute;
  currentRoute = name;
  trackView(name || "estoque");
  $$("#menu a").forEach((a) => a.classList.toggle("on", a.dataset.route === name));
  $("menu").classList.remove("open");
  renderTray();

  if (!name) {
    home.hidden = false;
    page.hidden = true;
    page.innerHTML = "";
    document.title = "VW Seminovos";
    if (cars.length) { renderGrid(); renderRecent(); }
    if (anchor) $(anchor).scrollIntoView();
    else if (prev !== "") window.scrollTo(0, homeScroll);
    return;
  }

  home.hidden = true;
  page.hidden = false;
  window.scrollTo(0, 0);
  if (loadError && name !== "creditos") {
    page.innerHTML = '<p class="status">Não foi possível carregar o estoque. Verifique se a API está no ar.</p>';
    return;
  }
  const view = (routes[name] || (() => viewNotFound()))(args);
  page.innerHTML = view.html;
  document.title = `${view.title} · VW Seminovos`;
  if (view.mount) view.mount();
}

/* ============ eventos globais ============ */
document.addEventListener("click", (e) => {
  const fav = e.target.closest("[data-fav]");
  if (fav) { e.preventDefault(); toggleFav(Number(fav.dataset.fav)); return; }
  const cmpBtn = e.target.closest("[data-cmp]");
  if (cmpBtn) { e.preventDefault(); toggleCmp(Number(cmpBtn.dataset.cmp)); return; }
  if (e.target.closest("[data-clear]")) { clearFilters(); return; }
  if (e.target.closest("#tray-go.disabled")) { e.preventDefault(); toast("Escolha pelo menos 2 carros para comparar."); return; }
  const c = e.target.closest(".card[data-id]");
  if (c && !e.target.closest("a")) location.hash = `#/carro/${c.dataset.id}`;
});

$("filters").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  activeCat = b.dataset.cat;
  renderChips();
  renderGrid();
});
["search", "f-fuel", "f-price", "sort"].forEach((id) => $(id).addEventListener("input", renderGrid));
$("clear").addEventListener("click", clearFilters);
$("go-stock").addEventListener("click", () => $("estoque").scrollIntoView({ behavior: "smooth" }));
$("menu-btn").addEventListener("click", () => $("menu").classList.toggle("open"));
window.addEventListener("hashchange", route);

(async () => {
  syncBadges();
  try {
    cars = await api("/cars");
    initHome();
  } catch {
    loadError = true;
    grid.innerHTML = '<p class="status">Não foi possível carregar o estoque. Verifique se a API está no ar.</p>';
  }
  route();
})();
