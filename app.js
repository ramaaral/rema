const TZ = "America/Montevideo";
const KEY = "rema.v1";

const NAV = [
  { id: "hoy", label: "Hoy" },
  { id: "agenda", label: "Agenda" },
  { id: "habitos", label: "Hábitos" },
  { id: "plata", label: "Plata" },
  { id: "mas", label: "Más" }
];

const MORE = [
  { id: "gym", label: "Gym" },
  { id: "comidas", label: "Comidas" },
  { id: "diario", label: "Diario" },
  { id: "objetivos", label: "Objetivos" },
  { id: "ajustes", label: "Ajustes" }
];

const CATS = ["comida", "super", "transporte", "gym", "ocio", "servicios", "estudio", "salud", "suscripciones", "extra", "ingreso"];

const POINTS = {
  noche: 10,
  aprendio: 10,
  plan: 10,
  gym: 15,
  comida: 10,
  estudio: 15,
  gastos: 10,
  habito: 5,
  completo: 20
};

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function todayISO(d = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function prettyDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 15));
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(dt);
}

function weekdayIndex(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function money(n) {
  const v = Number(n) || 0;
  return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(v);
}

function usd(uyu, rate) {
  const r = Number(rate) || 0;
  if (!r) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(uyu / r);
}

function defaultState() {
  return {
    version: 1,
    settings: { name: "RAMA", usdRate: 40, nightHour: "21:30", accent: "#c6f25c" },
    blocks: [
      { id: uid(), start: "09:00", end: "10:30", title: "Estudiar", days: [1, 2, 3, 4, 5] },
      { id: uid(), start: "19:00", end: "20:30", title: "Gym", days: [1, 3, 5] }
    ],
    habits: [
      { id: uid(), name: "Ir al gym", done: {} },
      { id: uid(), name: "Comer mejor", done: {} },
      { id: uid(), name: "Estudiar el bloque", done: {} },
      { id: uid(), name: "Registrar gastos", done: {} },
      { id: uid(), name: "Ritual de noche", done: {} }
    ],
    gym: [], meals: [], moves: [], bills: [], journal: {}, goals: [], points: {}
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    return { ...defaultState(), ...data, settings: { ...defaultState().settings, ...(data.settings || {}) } };
  } catch {
    return defaultState();
  }
}

let S = load();
let view = "hoy";
let day = todayISO();

function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
function $(id) { return document.getElementById(id); }
function applyAccent() { document.documentElement.style.setProperty("--green", S.settings.accent || "#c6f25c"); }
function monthKey(iso = day) { return iso.slice(0, 7); }
function pointsMonth() {
  const m = monthKey();
  return Object.entries(S.points).filter(([k]) => k.startsWith(m)).reduce((a, [, v]) => a + (v.total || 0), 0);
}
function pointsToday() { return (S.points[day] && S.points[day].total) || 0; }
function setPoints(iso, patch) {
  const cur = S.points[iso] || { items: {}, total: 0 };
  const items = { ...cur.items, ...patch };
  const total = Object.values(items).reduce((a, b) => a + (Number(b) || 0), 0);
  S.points[iso] = { items, total };
}
function level(n) {
  if (n >= 600) return "En racha";
  if (n >= 400) return "Firme";
  if (n >= 200) return "Constante";
  return "Arranque";
}
function yesterdayISO() {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return todayISO(dt);
}
function lastLearning() {
  const y = yesterdayISO();
  return (S.journal[y] && S.journal[y].learned) || (S.journal[day] && S.journal[day].learned) || "";
}
function lastMorning() {
  const y = yesterdayISO();
  return (S.journal[y] && S.journal[y].morning) || "";
}
function todayBlocks() {
  const wd = weekdayIndex(day);
  return S.blocks.filter((b) => (b.days || []).includes(wd)).sort((a, b) => a.start.localeCompare(b.start));
}
function movesOf(iso = day) { return S.moves.filter((m) => m.date === iso); }
function monthMoves() { return S.moves.filter((x) => x.date.startsWith(monthKey())); }
function totals(list) {
  const inc = list.filter((x) => x.type === "ingreso").reduce((a, b) => a + Number(b.amount), 0);
  const out = list.filter((x) => x.type === "gasto").reduce((a, b) => a + Number(b.amount), 0);
  return { inc, out, net: inc - out };
}
function openSheet(html) {
  $("sheet").innerHTML = `<div class="handle"></div>${html}`;
  $("sheet-bg").hidden = false;
}
function closeSheet() { $("sheet-bg").hidden = true; $("sheet").innerHTML = ""; }
$("sheet-bg").addEventListener("click", (e) => { if (e.target.id === "sheet-bg") closeSheet(); });
function go(id) {
  if (id === "mas") {
    openSheet(`<h2>Módulos</h2><div class="list">${MORE.map((m) => `<button class="item" data-go="${m.id}"><div class="grow">${m.label}</div><span class="tiny">abrir</span></button>`).join("")}</div>`);
    return;
  }
  view = id; closeSheet(); render();
}
document.body.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) go(g.getAttribute("data-go"));
});
function svg(name) {
  const p = {
    hoy: "M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1z",
    agenda: "M7 4h10v3H7zM5 8h14v12H5z",
    habitos: "M5 12l4 4 10-10",
    plata: "M4 7h16v10H4zM4 11h16",
    mas: "M6 12h12M12 6v12"
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${p[name]}"/></svg>`;
}
function nav() {
  $("tabbar").innerHTML = NAV.map((n) => `<button class="${view === n.id || (n.id === "mas" && MORE.some((m) => m.id === view)) ? "on" : ""}" data-go="${n.id}">${svg(n.id)}<span>${n.label}</span></button>`).join("");
  $("rail-nav").innerHTML = [...NAV.filter((n) => n.id !== "mas"), ...MORE].map((n) => `<button class="${view === n.id ? "on" : ""}" data-go="${n.id}">${n.label}</button>`).join("");
}
function titles() {
  const map = {
    hoy: ["Hoy", prettyDate(day)], agenda: ["Agenda", "Bloques del día"], habitos: ["Hábitos", "Lo que se tilda"],
    plata: ["Plata", "UYU y dólares"], gym: ["Gym", "Cuerpo"], comidas: ["Comidas", "Mesa"],
    diario: ["Diario", "Noche y mañana"], objetivos: ["Objetivos", "Cumbre y puntos"], ajustes: ["Ajustes", "REMA"]
  };
  const t = map[view] || ["REMA", ""];
  $("top-kicker").textContent = t[0];
  $("top-title").textContent = t[1];
  $("rail-date").textContent = prettyDate(day);
  $("rail-points").textContent = `${pointsMonth()} pts · ${level(pointsMonth())}`;
}
function render() {
  applyAccent(); nav(); titles();
  const root = $("view");
  const screens = { hoy, agenda, habitos, plata, gym, comidas, diario, objetivos, ajustes };
  root.innerHTML = (screens[view] || hoy)();
  bind();
}
function hoy() {
  const learned = lastLearning();
  const morning = lastMorning();
  const blocks = todayBlocks();
  const t = totals(movesOf(day));
  const habitsDone = S.habits.filter((h) => h.done[day]).length;
  return `
    <article class="card hero">
      <h3>Aprendizaje de ayer</h3>
      <div class="learned">${learned ? escapeHtml(learned) : "Anoche todavía no cargaste nada. El ritual de noche alimenta esta pantalla."}</div>
      ${morning ? `<p>${escapeHtml(morning)}</p>` : ""}
    </article>
    <div class="grid-2">
      <div class="stat"><span>Puntos del día</span><b>${pointsToday()}</b></div>
      <div class="stat"><span>Mes · ${level(pointsMonth())}</span><b>${pointsMonth()}</b></div>
    </div>
    <article class="card">
      <div class="between"><h3>Hoy</h3><button class="chip" data-go="agenda">editar</button></div>
      ${blocks.length ? `<div class="timeline">${blocks.map((b) => `<div class="block"><time>${b.start}–${b.end}</time><div>${escapeHtml(b.title)}</div></div>`).join("")}</div>` : `<div class="empty">No hay bloques para este día. Cargalos en Agenda.</div>`}
    </article>
    <article class="card">
      <div class="between"><h3>Hábitos ${habitsDone}/${S.habits.length}</h3><button class="chip" data-go="habitos">abrir</button></div>
      <div class="list">${S.habits.map((h) => itemCheck(h.id, h.name, !!h.done[day], "habit")).join("")}</div>
    </article>
    <div class="grid-2">
      <div class="stat"><span>Gastado hoy</span><b>$ ${money(t.out)}</b><div class="tiny">${usd(t.out, S.settings.usdRate)}</div></div>
      <div class="stat"><span>Ingreso hoy</span><b class="ok">$ ${money(t.inc)}</b><div class="tiny">${usd(t.inc, S.settings.usdRate)}</div></div>
    </div>
    <div class="row"><button class="btn primary wide" data-act="noche">Ritual de noche</button></div>`;
}
function agenda() {
  const blocks = todayBlocks();
  return `
    <article class="card">
      <div class="between"><h3>${prettyDate(day)}</h3><input type="date" id="pick-day" value="${day}" /></div>
      ${blocks.length ? `<div class="timeline">${blocks.map((b) => `<div class="block"><time>${b.start}–${b.end}</time><div>${escapeHtml(b.title)}</div><button class="ghost" data-act="del-block" data-id="${b.id}">✕</button></div>`).join("")}</div>` : `<div class="empty">Sin bloques este día.</div>`}
    </article>
    <button class="btn primary wide" data-act="add-block">Sumar bloque</button>
    <article class="card">
      <h3>Todos los bloques semanales</h3>
      <div class="list">${S.blocks.map((b) => `<div class="item"><div class="grow"><div>${escapeHtml(b.title)}</div><div class="meta">${b.start}–${b.end} · ${daysLabel(b.days)}</div></div></div>`).join("") || `<div class="empty">Todavía no hay rutina.</div>`}</div>
    </article>`;
}
function daysLabel(days) {
  const names = ["D", "L", "M", "X", "J", "V", "S"];
  return (days || []).map((d) => names[d]).join(" ");
}
function habitos() {
  return `<article class="card"><h3>${prettyDate(day)}</h3><div class="list">${S.habits.map((h) => itemCheck(h.id, h.name, !!h.done[day], "habit")).join("")}</div></article>
    <button class="btn wide" data-act="add-habit">Nuevo hábito</button>
    <p class="tiny">Máximo sano: 5 activos. Tildar de noche suma puntos.</p>`;
}
function plata() {
  const m = totals(monthMoves());
  const t = totals(movesOf(day));
  const pending = S.bills.filter((b) => !b.paid);
  const pendingSum = pending.reduce((a, b) => a + Number(b.amount), 0);
  const left = m.inc - m.out - pendingSum;
  return `
    <div class="grid-2">
      <div class="stat"><span>Este mes gastaste</span><b>$ ${money(m.out)}</b><div class="tiny">${usd(m.out, S.settings.usdRate)}</div></div>
      <div class="stat"><span>Ingresó</span><b class="ok">$ ${money(m.inc)}</b><div class="tiny">${usd(m.inc, S.settings.usdRate)}</div></div>
    </div>
    <article class="card">
      <h3>¿Cuánto queda?</h3>
      <div class="pts">${left >= 0 ? "$ " + money(left) : "\u2212 $ " + money(Math.abs(left))}</div>
      <div class="tiny">Ingresos del mes \u2212 gastos \u2212 pagos pendientes \u00b7 ${usd(left, S.settings.usdRate)}</div>
    </article>
    <article class="card">
      <div class="between"><h3>Hoy</h3><span class="tiny">neto $ ${money(t.net)}</span></div>
      <div class="list">${movesOf(day).map((x) => `<div class="item"><div class="grow"><div>${escapeHtml(x.note || x.category)}</div><div class="meta">${x.category} \u00b7 ${usd(x.amount, S.settings.usdRate)}</div></div><div class="amt ${x.type === "ingreso" ? "in" : "out"}">${x.type === "ingreso" ? "+" : "\u2212"} $ ${money(x.amount)}</div><button class="ghost" data-act="del-move" data-id="${x.id}">\u2715</button></div>`).join("") || `<div class="empty">Nada cargado hoy.</div>`}</div>
    </article>
    <div class="row"><button class="btn primary wide" data-act="add-move">Registrar</button><button class="btn wide" data-act="add-bill">Pago</button></div>
    <article class="card">
      <h3>Tengo que pagar</h3>
      <div class="list">${S.bills.map((b) => `<div class="item"><button class="check ${b.paid ? "on" : ""}" data-act="toggle-bill" data-id="${b.id}"></button><div class="grow"><div>${escapeHtml(b.name)}</div><div class="meta">${b.due || "sin fecha"} \u00b7 $ ${money(b.amount)} \u00b7 ${usd(b.amount, S.settings.usdRate)}</div></div></div>`).join("") || `<div class="empty">Sin vencimientos.</div>`}</div>
    </article>
    <p class="tiny">1 USD = $ ${money(S.settings.usdRate)} UYU \u00b7 se cambia en Ajustes.</p>`;
}
function gym() {
  const sessions = S.gym.filter((g) => g.date === day);
  const recent = [...S.gym].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return `<article class="card hero"><h3>Hoy</h3><div class="learned">${sessions.length ? sessions.map((s) => s.title).join(" \u00b7 ") : "Todav\u00eda no entrenaste."}</div></article>
    <button class="btn primary wide" data-act="add-gym">Registrar sesi\u00f3n</button>
    <article class="card"><h3>\u00daltimas</h3><div class="list">${recent.map((g) => `<div class="item"><div class="grow"><div>${escapeHtml(g.title)}</div><div class="meta">${g.date}${g.note ? " \u00b7 " + escapeHtml(g.note) : ""}</div></div></div>`).join("") || `<div class="empty">Sin historial.</div>`}</div></article>`;
}
function comidas() {
  const slots = ["desayuno", "almuerzo", "merienda", "cena"];
  const todayMeals = S.meals.filter((m) => m.date === day);
  return `<article class="card"><h3>${prettyDate(day)}</h3><div class="list">${slots.map((slot) => {
    const found = todayMeals.find((m) => m.slot === slot);
    return `<div class="item"><div class="grow"><div>${slot}</div><div class="meta">${found ? escapeHtml(found.text) : "sin cargar"}</div></div><button class="chip ${found && found.good ? "on" : ""}" data-act="meal" data-slot="${slot}">${found ? "editar" : "sumar"}</button></div>`;
  }).join("")}</div></article><p class="tiny">\u201cComer mejor\u201d = 2 comidas reales. Si las marc\u00e1s bien, de noche suman puntos.</p>`;
}
function diario() {
  const j = S.journal[day] || { facts: "", learned: "", tomorrow: "", morning: "" };
  return `<article class="card hero"><h3>Entrada de ma\u00f1ana</h3><div class="learned">${j.morning ? escapeHtml(j.morning) : "Se escribe sola cuando cerr\u00e1s la noche."}</div></article>
    <article class="card"><h3>Noche de ${prettyDate(day)}</h3><div class="form-grid">
      <div class="field"><label>Hechos</label><textarea id="j-facts">${escapeHtml(j.facts)}</textarea></div>
      <div class="field"><label>Qu\u00e9 aprend\u00ed</label><textarea id="j-learned">${escapeHtml(j.learned)}</textarea></div>
      <div class="field"><label>Ma\u00f1ana (m\u00e1ximo 3 cosas)</label><textarea id="j-tomorrow">${escapeHtml(j.tomorrow)}</textarea></div>
      <button class="btn primary" data-act="save-journal">Cerrar el d\u00eda y sumar puntos</button>
    </div></article>`;
}
function objetivos() {
  const open = S.goals.filter((g) => !g.done);
  const done = S.goals.filter((g) => g.done);
  const p = S.points[day] || { items: {}, total: 0 };
  return `<article class="card hero"><h3>Puntos del mes</h3><div class="pts">${pointsMonth()}</div><p>${level(pointsMonth())} \u00b7 hoy ${p.total || 0}</p></article>
    <article class="card"><h3>Detalle de hoy</h3><div class="list">${Object.keys(POINTS).map((k) => `<div class="item"><div class="grow">${k}</div><div class="tiny">${p.items[k] ? "+" + p.items[k] : "\u2014"}</div></div>`).join("")}</div></article>
    <article class="card"><div class="between"><h3>Activos</h3><button class="chip" data-act="add-goal">nuevo</button></div>
      <div class="list">${open.map((g) => `<div class="item"><button class="check" data-act="toggle-goal" data-id="${g.id}"></button><div class="grow"><div>${escapeHtml(g.title)}</div><div class="meta">${g.layer}</div></div></div>`).join("") || `<div class="empty">Sin objetivos. Sum\u00e1 uno del mes.</div>`}</div></article>
    ${done.length ? `<article class="card"><h3>Hechos</h3><div class="list">${done.map((g) => `<div class="item"><button class="check on" data-act="toggle-goal" data-id="${g.id}"></button><div class="grow">${escapeHtml(g.title)}</div></div>`).join("")}</div></article>` : ""}`;
}
function ajustes() {
  return `<article class="card"><div class="form-grid">
      <div class="field"><label>Tu nombre</label><input id="s-name" value="${escapeHtml(S.settings.name)}" /></div>
      <div class="field"><label>1 USD equivale a (UYU)</label><input id="s-rate" type="number" step="0.01" value="${S.settings.usdRate}" /></div>
      <div class="field"><label>Hora ritual de noche</label><input id="s-night" type="time" value="${S.settings.nightHour}" /></div>
      <div class="field"><label>Color verde</label><input id="s-accent" type="color" value="${S.settings.accent}" /></div>
      <button class="btn primary" data-act="save-settings">Guardar ajustes</button>
    </div></article>
    <article class="card"><h3>iCloud / otros aparatos</h3>
      <p class="tiny">REMA es una web-app. Safari no puede escribir solo en iCloud. Export\u00e1 remo.json a iCloud Drive e importalo en el otro aparato.</p>
      <div class="actions"><button class="btn" data-act="export">Exportar</button><button class="btn" data-act="import">Importar</button></div>
      <input id="file-import" type="file" accept="application/json" hidden /></article>
    <article class="card"><h3>Anclar como app</h3>
      <p class="tiny"><b>iPhone / iPad:</b> Safari \u2192 Compartir \u2192 A\u00f1adir a pantalla de inicio.<br/><b>Mac:</b> Safari \u2192 Archivo \u2192 A\u00f1adir al Dock.</p></article>
    <button class="btn danger wide" data-act="reset">Borrar todo este aparato</button>`;
}
function itemCheck(id, name, on, kind) {
  return `<div class="item"><button class="check ${on ? "on" : ""}" data-act="toggle-${kind}" data-id="${id}"></button><div class="grow">${escapeHtml(name)}</div></div>`;
}
function escapeHtml(s) {
  return String(s || "").replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, """);
}
function bind() {
  const pick = $("pick-day");
  if (pick) pick.addEventListener("change", () => { day = pick.value; render(); });
  document.querySelectorAll("[data-act]").forEach((el) => el.addEventListener("click", () => act(el.dataset.act, el.dataset)));
}
function act(name, data) {
  const actions = {
    "toggle-habit": () => {
      const h = S.habits.find((x) => x.id === data.id);
      if (!h) return;
      h.done[day] = !h.done[day];
      setPoints(day, { habito: S.habits.filter((x) => x.done[day]).length * POINTS.habito });
      save(); render();
    },
    "add-habit": () => {
      openSheet(`<h2>Nuevo h\u00e1bito</h2><div class="form-grid"><div class="field"><label>Nombre</label><input id="f-habit" placeholder="Ej. agua 2 litros" /></div><button class="btn primary" id="ok-habit">Guardar</button></div>`);
      $("ok-habit").onclick = () => {
        const name = $("f-habit").value.trim();
        if (!name) return;
        S.habits.push({ id: uid(), name, done: {} });
        save(); closeSheet(); render();
      };
    },
    "add-block": () => {
      openSheet(`<h2>Bloque</h2><div class="form-grid"><div class="field"><label>Qu\u00e9</label><input id="f-title" placeholder="Estudiar" /></div><div class="grid-2"><div class="field"><label>Desde</label><input id="f-start" type="time" value="09:00" /></div><div class="field"><label>Hasta</label><input id="f-end" type="time" value="10:30" /></div></div><div class="field"><label>D\u00edas</label><div class="row" id="f-days" style="flex-wrap:wrap">${["D","L","M","X","J","V","S"].map((n,i)=>`<button type="button" class="chip ${[1,2,3,4,5].includes(i)?"on":""}" data-d="${i}">${n}</button>`).join("")}</div></div><button class="btn primary" id="ok-block">Guardar</button></div>`);
      const days = new Set([1,2,3,4,5]);
      $("f-days").onclick = (e) => {
        const b = e.target.closest("[data-d]");
        if (!b) return;
        const d = Number(b.dataset.d);
        if (days.has(d)) days.delete(d); else days.add(d);
        b.classList.toggle("on");
      };
      $("ok-block").onclick = () => {
        S.blocks.push({ id: uid(), title: $("f-title").value.trim() || "Bloque", start: $("f-start").value, end: $("f-end").value, days: [...days] });
        save(); closeSheet(); render();
      };
    },
    "del-block": () => { S.blocks = S.blocks.filter((b) => b.id !== data.id); save(); render(); },
    "add-move": () => {
      openSheet(`<h2>Movimiento</h2><div class="form-grid"><div class="field"><label>Tipo</label><select id="f-type"><option value="gasto">Gasto</option><option value="ingreso">Ingreso</option></select></div><div class="field"><label>Monto UYU</label><input id="f-amt" type="number" inputmode="decimal" placeholder="800" /></div><div class="field"><label>Categor\u00eda</label><select id="f-cat">${CATS.map((c)=>`<option>${c}</option>`).join("")}</select></div><div class="field"><label>Nota</label><input id="f-note" placeholder="super, nafta..." /></div><button class="btn primary" id="ok-move">Guardar</button></div>`);
      $("ok-move").onclick = () => {
        const amount = Number($("f-amt").value);
        if (!amount) return;
        S.moves.push({ id: uid(), date: day, type: $("f-type").value, amount, category: $("f-cat").value, note: $("f-note").value.trim() });
        if (movesOf(day).some((m) => m.type === "gasto")) setPoints(day, { gastos: POINTS.gastos });
        save(); closeSheet(); render();
      };
    },
    "del-move": () => { S.moves = S.moves.filter((m) => m.id !== data.id); save(); render(); },
    "add-bill": () => {
      openSheet(`<h2>Pago</h2><div class="form-grid"><div class="field"><label>Qu\u00e9</label><input id="f-bn" placeholder="UTE, alquiler" /></div><div class="field"><label>Monto UYU</label><input id="f-ba" type="number" /></div><div class="field"><label>Vence</label><input id="f-bd" type="date" value="${day}" /></div><button class="btn primary" id="ok-bill">Guardar</button></div>`);
      $("ok-bill").onclick = () => {
        S.bills.push({ id: uid(), name: $("f-bn").value.trim() || "Pago", amount: Number($("f-ba").value) || 0, due: $("f-bd").value, paid: false });
        save(); closeSheet(); render();
      };
    },
    "toggle-bill": () => { const b = S.bills.find((x) => x.id === data.id); if (b) b.paid = !b.paid; save(); render(); },
    "add-gym": () => {
      openSheet(`<h2>Sesi\u00f3n</h2><div class="form-grid"><div class="field"><label>Tipo</label><select id="f-gt"><option>Full body</option><option>Empuje</option><option>Tir\u00f3n</option><option>Piernas</option><option>Cardio</option><option>Movilidad</option></select></div><div class="field"><label>Nota</label><input id="f-gn" /></div><button class="btn primary" id="ok-gym">Hecho</button></div>`);
      $("ok-gym").onclick = () => {
        S.gym.push({ id: uid(), date: day, title: $("f-gt").value, note: $("f-gn").value.trim() });
        const habit = S.habits.find((h) => /gym/i.test(h.name));
        if (habit) habit.done[day] = true;
        setPoints(day, { gym: POINTS.gym });
        save(); closeSheet(); render();
      };
    },
    meal: () => {
      const slot = data.slot;
      const found = S.meals.find((m) => m.date === day && m.slot === slot);
      openSheet(`<h2>${slot}</h2><div class="form-grid"><div class="field"><label>Qu\u00e9 comiste</label><input id="f-mt" value="${found ? escapeHtml(found.text) : ""}" /></div><div class="field"><label>\u00bfComida real?</label><select id="f-mg"><option value="1" ${found && found.good ? "selected" : ""}>S\u00ed</option><option value="0" ${found && !found.good ? "selected" : ""}>No tanto</option></select></div><button class="btn primary" id="ok-meal">Guardar</button></div>`);
      $("ok-meal").onclick = () => {
        const text = $("f-mt").value.trim();
        const good = $("f-mg").value === "1";
        S.meals = S.meals.filter((m) => !(m.date === day && m.slot === slot));
        S.meals.push({ id: uid(), date: day, slot, text, good });
        if (S.meals.filter((m) => m.date === day && m.good).length >= 2) {
          const habit = S.habits.find((h) => /comer/i.test(h.name));
          if (habit) habit.done[day] = true;
          setPoints(day, { comida: POINTS.comida });
        }
        save(); closeSheet(); render();
      };
    },
    "save-journal": () => {
      const facts = $("j-facts").value.trim();
      const learned = $("j-learned").value.trim();
      const tomorrow = $("j-tomorrow").value.trim();
      const morning = learned ? `${learned}${tomorrow ? " Ma\u00f1ana: " + tomorrow.split("\n").filter(Boolean).slice(0, 3).join(" \u00b7 ") : ""}` : tomorrow;
      S.journal[day] = { facts, learned, tomorrow, morning };
      const patch = { noche: POINTS.noche };
      if (learned) patch.aprendio = POINTS.aprendio;
      if (tomorrow) patch.plan = POINTS.plan;
      const habit = S.habits.find((h) => /noche/i.test(h.name));
      if (habit) habit.done[day] = true;
      if (S.habits.find((h) => /estudi/i.test(h.name) && h.done[day])) patch.estudio = POINTS.estudio;
      const items = { ...(S.points[day]?.items || {}), ...patch };
      if (["noche", "aprendio", "plan", "gym", "comida", "estudio", "gastos"].filter((k) => items[k]).length >= 5) patch.completo = POINTS.completo;
      setPoints(day, patch);
      save(); go("hoy");
    },
    noche: () => go("diario"),
    "add-goal": () => {
      openSheet(`<h2>Objetivo</h2><div class="form-grid"><div class="field"><label>Texto observable</label><input id="f-goalt" placeholder="Estudiar 90 min" /></div><div class="field"><label>Capa</label><select id="f-goall"><option value="d\u00eda">del d\u00eda</option><option value="semana">de la semana</option><option value="mes" selected>del mes</option></select></div><button class="btn primary" id="ok-goal">Guardar</button></div>`);
      $("ok-goal").onclick = () => {
        const title = $("f-goalt").value.trim();
        if (!title) return;
        S.goals.push({ id: uid(), title, layer: $("f-goall").value, done: false });
        save(); closeSheet(); render();
      };
    },
    "toggle-goal": () => { const g = S.goals.find((x) => x.id === data.id); if (g) g.done = !g.done; save(); render(); },
    "save-settings": () => {
      S.settings.name = $("s-name").value.trim() || "RAMA";
      S.settings.usdRate = Number($("s-rate").value) || 40;
      S.settings.nightHour = $("s-night").value || "21:30";
      S.settings.accent = $("s-accent").value || "#c6f25c";
      save(); render();
    },
    export: () => {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `rema-${todayISO()}.json`;
      a.click();
    },
    import: () => $("file-import").click(),
    reset: () => {
      if (!confirm("Esto borra REMA solo en este aparato.")) return;
      localStorage.removeItem(KEY);
      S = defaultState();
      save(); render();
    }
  };
  if (actions[name]) actions[name]();
}
$("btn-more").onclick = () => go("mas");
document.addEventListener("change", (e) => {
  if (e.target.id === "file-import" && e.target.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !data.settings) throw new Error("archivo raro");
        S = { ...defaultState(), ...data };
        save(); closeSheet(); render();
      } catch { alert("No pude leer ese archivo."); }
    };
    reader.readAsText(e.target.files[0]);
  }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
render();
