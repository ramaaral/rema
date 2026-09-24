const TZ = "America/Montevideo";
const KEY = "rema.v1";
const NAV = [
  { id: "hoy", label: "Hoy" },
  { id: "agenda", label: "Agenda" },
  { id: "habitos", label: "Habitos" },
  { id: "plata", label: "Plata" },
  { id: "mas", label: "Mas" }
];
const MORE = [
  { id: "gym", label: "Gym" },
  { id: "comidas", label: "Comidas" },
  { id: "diario", label: "Diario" },
  { id: "objetivos", label: "Objetivos" },
  { id: "ajustes", label: "Ajustes" }
];
const CATS = ["comida", "super", "transporte", "gym", "ocio", "servicios", "estudio", "salud", "suscripciones", "extra", "ingreso"];
const POINTS = { noche: 10, aprendio: 10, plan: 10, gym: 15, comida: 10, estudio: 15, gastos: 10, habito: 5, completo: 20 };

function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function todayISO(d) {
  d = d || new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function prettyDate(iso) {
  var p = iso.split("-").map(Number);
  var dt = new Date(Date.UTC(p[0], p[1] - 1, p[2], 15));
  return new Intl.DateTimeFormat("es-UY", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(dt);
}
function weekdayIndex(iso) {
  var p = iso.split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]).getDay();
}
function money(n) { return new Intl.NumberFormat("es-UY", { maximumFractionDigits: 0 }).format(Number(n) || 0); }
function usd(uyu, rate) {
  rate = Number(rate) || 0;
  if (!rate) return "-";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(uyu / rate);
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"]/g, function (ch) {
    if (ch === "&") return "\u0026amp;";
    if (ch === "<") return "\u0026lt;";
    if (ch === ">") return "\u0026gt;";
    if (ch === '"') return "\u0026quot;";
    return ch;
  });
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
    var raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    var data = JSON.parse(raw);
    var base = defaultState();
    return Object.assign(base, data, { settings: Object.assign(base.settings, data.settings || {}) });
  } catch (e) { return defaultState(); }
}

var S = load();
var view = "hoy";
var day = todayISO();

function save() { localStorage.setItem(KEY, JSON.stringify(S)); }
function $(id) { return document.getElementById(id); }
function applyAccent() { document.documentElement.style.setProperty("--green", S.settings.accent || "#c6f25c"); }
function monthKey(iso) { return (iso || day).slice(0, 7); }
function pointsMonth() {
  var m = monthKey();
  var tot = 0;
  Object.keys(S.points).forEach(function (k) { if (k.indexOf(m) === 0) tot += (S.points[k].total || 0); });
  return tot;
}
function pointsToday() { return (S.points[day] && S.points[day].total) || 0; }
function setPoints(iso, patch) {
  var cur = S.points[iso] || { items: {}, total: 0 };
  var items = Object.assign({}, cur.items, patch);
  var total = 0;
  Object.keys(items).forEach(function (k) { total += Number(items[k]) || 0; });
  S.points[iso] = { items: items, total: total };
}
function level(n) {
  if (n >= 600) return "En racha";
  if (n >= 400) return "Firme";
  if (n >= 200) return "Constante";
  return "Arranque";
}
function yesterdayISO() {
  var p = day.split("-").map(Number);
  var dt = new Date(p[0], p[1] - 1, p[2]);
  dt.setDate(dt.getDate() - 1);
  return todayISO(dt);
}
function lastLearning() {
  var y = yesterdayISO();
  return (S.journal[y] && S.journal[y].learned) || (S.journal[day] && S.journal[day].learned) || "";
}
function lastMorning() {
  var y = yesterdayISO();
  return (S.journal[y] && S.journal[y].morning) || "";
}
function todayBlocks() {
  var wd = weekdayIndex(day);
  return S.blocks.filter(function (b) { return (b.days || []).indexOf(wd) >= 0; }).sort(function (a, b) { return a.start.localeCompare(b.start); });
}
function movesOf(iso) { return S.moves.filter(function (m) { return m.date === (iso || day); }); }
function monthMoves() { var m = monthKey(); return S.moves.filter(function (x) { return x.date.indexOf(m) === 0; }); }
function totals(list) {
  var inc = 0, out = 0;
  list.forEach(function (x) { if (x.type === "ingreso") inc += Number(x.amount); else out += Number(x.amount); });
  return { inc: inc, out: out, net: inc - out };
}
function openSheet(html) { $("sheet").innerHTML = "<div class=\"handle\"></div>" + html; $("sheet-bg").hidden = false; }
function closeSheet() { $("sheet-bg").hidden = true; $("sheet").innerHTML = ""; }
function go(id) {
  if (id === "mas") {
    var html = "<h2>Modulos</h2><div class=\"list\">";
    MORE.forEach(function (m) { html += "<button class=\"item\" data-go=\"" + m.id + "\"><div class=\"grow\">" + m.label + "</div><span class=\"tiny\">abrir</span></button>"; });
    openSheet(html + "</div>");
    return;
  }
  view = id; closeSheet(); render();
}
function svg(name) {
  var p = { hoy: "M4 11l8-7 8 7v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1z", agenda: "M7 4h10v3H7zM5 8h14v12H5z", habitos: "M5 12l4 4 10-10", plata: "M4 7h16v10H4zM4 11h16", mas: "M6 12h12M12 6v12" };
  return "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"" + p[name] + "\"/></svg>";
}
function itemCheck(id, name, on, kind) {
  return "<div class=\"item\"><button class=\"check " + (on ? "on" : "") + "\" data-act=\"toggle-" + kind + "\" data-id=\"" + id + "\"></button><div class=\"grow\">" + escapeHtml(name) + "</div></div>";
}
function daysLabel(days) {
  var names = ["D", "L", "M", "X", "J", "V", "S"];
  return (days || []).map(function (d) { return names[d]; }).join(" ");
}
function nav() {
  $("tabbar").innerHTML = NAV.map(function (n) {
    var on = view === n.id || (n.id === "mas" && MORE.some(function (m) { return m.id === view; }));
    return "<button class=\"" + (on ? "on" : "") + "\" data-go=\"" + n.id + "\">" + svg(n.id) + "<span>" + n.label + "</span></button>";
  }).join("");
  $("rail-nav").innerHTML = NAV.filter(function (n) { return n.id !== "mas"; }).concat(MORE).map(function (n) {
    return "<button class=\"" + (view === n.id ? "on" : "") + "\" data-go=\"" + n.id + "\">" + n.label + "</button>";
  }).join("");
}
function titles() {
  var map = {
    hoy: ["Hoy", prettyDate(day)], agenda: ["Agenda", "Bloques del dia"], habitos: ["Habitos", "Lo que se tilda"],
    plata: ["Plata", "UYU y dolares"], gym: ["Gym", "Cuerpo"], comidas: ["Comidas", "Mesa"],
    diario: ["Diario", "Noche y manana"], objetivos: ["Objetivos", "Puntos"], ajustes: ["Ajustes", "REMA"]
  };
  var t = map[view] || ["REMA", ""];
  $("top-kicker").textContent = t[0];
  $("top-title").textContent = t[1];
  $("rail-date").textContent = prettyDate(day);
  $("rail-points").textContent = pointsMonth() + " pts";
}
function screenHoy() {
  var learned = lastLearning();
  var blocks = todayBlocks();
  var t = totals(movesOf(day));
  var habitsDone = S.habits.filter(function (h) { return h.done[day]; }).length;
  var html = "<article class=\"card hero\"><h3>Aprendizaje de ayer</h3><div class=\"learned\">" +
    (learned ? escapeHtml(learned) : "Anoche todavia no cargaste nada. El ritual de noche alimenta esta pantalla.") +
    "</div></article>";
  html += "<div class=\"grid-2\"><div class=\"stat\"><span>Puntos del dia</span><b>" + pointsToday() + "</b></div><div class=\"stat\"><span>Mes · " + level(pointsMonth()) + "</span><b>" + pointsMonth() + "</b></div></div>";
  html += "<article class=\"card\"><div class=\"between\"><h3>Hoy</h3><button class=\"chip\" data-go=\"agenda\">editar</button></div>";
  if (blocks.length) {
    html += "<div class=\"timeline\">";
    blocks.forEach(function (b) { html += "<div class=\"block\"><time>" + b.start + "–" + b.end + "</time><div>" + escapeHtml(b.title) + "</div></div>"; });
    html += "</div>";
  } else html += "<div class=\"empty\">No hay bloques para este dia. Cargalos en Agenda.</div>";
  html += "</article><article class=\"card\"><div class=\"between\"><h3>Habitos " + habitsDone + "/" + S.habits.length + "</h3><button class=\"chip\" data-go=\"habitos\">abrir</button></div><div class=\"list\">";
  S.habits.forEach(function (h) { html += itemCheck(h.id, h.name, !!h.done[day], "habit"); });
  html += "</div></article><div class=\"grid-2\"><div class=\"stat\"><span>Gastado hoy</span><b>$ " + money(t.out) + "</b><div class=\"tiny\">" + usd(t.out, S.settings.usdRate) + "</div></div><div class=\"stat\"><span>Ingreso hoy</span><b class=\"ok\">$ " + money(t.inc) + "</b><div class=\"tiny\">" + usd(t.inc, S.settings.usdRate) + "</div></div></div>";
  html += "<div class=\"row\"><button class=\"btn primary wide\" data-act=\"noche\">Ritual de noche</button></div>";
  return html;
}
function screenAgenda() {
  var blocks = todayBlocks();
  var html = "<article class=\"card\"><div class=\"between\"><h3>" + prettyDate(day) + "</h3><input type=\"date\" id=\"pick-day\" value=\"" + day + "\" /></div>";
  if (blocks.length) {
    html += "<div class=\"timeline\">";
    blocks.forEach(function (b) { html += "<div class=\"block\"><time>" + b.start + "–" + b.end + "</time><div>" + escapeHtml(b.title) + "</div><button class=\"ghost\" data-act=\"del-block\" data-id=\"" + b.id + "\">x</button></div>"; });
    html += "</div>";
  } else html += "<div class=\"empty\">Sin bloques este dia.</div>";
  html += "</article><button class=\"btn primary wide\" data-act=\"add-block\">Sumar bloque</button><article class=\"card\"><h3>Todos los bloques semanales</h3><div class=\"list\">";
  S.blocks.forEach(function (b) { html += "<div class=\"item\"><div class=\"grow\"><div>" + escapeHtml(b.title) + "</div><div class=\"meta\">" + b.start + "–" + b.end + " · " + daysLabel(b.days) + "</div></div></div>"; });
  html += "</div></article>";
  return html;
}
function screenHabitos() {
  var html = "<article class=\"card\"><h3>" + prettyDate(day) + "</h3><div class=\"list\">";
  S.habits.forEach(function (h) { html += itemCheck(h.id, h.name, !!h.done[day], "habit"); });
  return html + "</div></article><button class=\"btn wide\" data-act=\"add-habit\">Nuevo habito</button>";
}
function screenPlata() {
  var m = totals(monthMoves());
  var t = totals(movesOf(day));
  var pending = S.bills.filter(function (b) { return !b.paid; });
  var pendingSum = 0;
  pending.forEach(function (b) { pendingSum += Number(b.amount); });
  var left = m.inc - m.out - pendingSum;
  var html = "<div class=\"grid-2\"><div class=\"stat\"><span>Este mes gastaste</span><b>$ " + money(m.out) + "</b><div class=\"tiny\">" + usd(m.out, S.settings.usdRate) + "</div></div><div class=\"stat\"><span>Ingreso</span><b class=\"ok\">$ " + money(m.inc) + "</b><div class=\"tiny\">" + usd(m.inc, S.settings.usdRate) + "</div></div></div>";
  html += "<article class=\"card\"><h3>Cuanto queda</h3><div class=\"pts\">$ " + money(left) + "</div><div class=\"tiny\">" + usd(left, S.settings.usdRate) + "</div></article>";
  html += "<article class=\"card\"><div class=\"between\"><h3>Hoy</h3><span class=\"tiny\">neto $ " + money(t.net) + "</span></div><div class=\"list\">";
  var today = movesOf(day);
  if (!today.length) html += "<div class=\"empty\">Nada cargado hoy.</div>";
  today.forEach(function (x) {
    html += "<div class=\"item\"><div class=\"grow\"><div>" + escapeHtml(x.note || x.category) + "</div><div class=\"meta\">" + x.category + "</div></div><div class=\"amt " + (x.type === "ingreso" ? "in" : "out") + "\">" + (x.type === "ingreso" ? "+" : "-") + " $ " + money(x.amount) + "</div><button class=\"ghost\" data-act=\"del-move\" data-id=\"" + x.id + "\">x</button></div>";
  });
  html += "</div></article><div class=\"row\"><button class=\"btn primary wide\" data-act=\"add-move\">Registrar</button><button class=\"btn wide\" data-act=\"add-bill\">Pago</button></div>";
  html += "<article class=\"card\"><h3>Tengo que pagar</h3><div class=\"list\">";
  if (!S.bills.length) html += "<div class=\"empty\">Sin vencimientos.</div>";
  S.bills.forEach(function (b) {
    html += "<div class=\"item\"><button class=\"check " + (b.paid ? "on" : "") + "\" data-act=\"toggle-bill\" data-id=\"" + b.id + "\"></button><div class=\"grow\"><div>" + escapeHtml(b.name) + "</div><div class=\"meta\">" + (b.due || "sin fecha") + " · $ " + money(b.amount) + "</div></div></div>";
  });
  html += "</div></article><p class=\"tiny\">1 USD = $ " + money(S.settings.usdRate) + " UYU</p>";
  return html;
}
function screenGym() {
  var sessions = S.gym.filter(function (g) { return g.date === day; });
  var recent = S.gym.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 8);
  var html = "<article class=\"card hero\"><h3>Hoy</h3><div class=\"learned\">" + (sessions.length ? sessions.map(function (s) { return s.title; }).join(" · ") : "Todavia no entrenaste.") + "</div></article>";
  html += "<button class=\"btn primary wide\" data-act=\"add-gym\">Registrar sesion</button><article class=\"card\"><h3>Ultimas</h3><div class=\"list\">";
  if (!recent.length) html += "<div class=\"empty\">Sin historial.</div>";
  recent.forEach(function (g) { html += "<div class=\"item\"><div class=\"grow\"><div>" + escapeHtml(g.title) + "</div><div class=\"meta\">" + g.date + "</div></div></div>"; });
  return html + "</div></article>";
}
function screenComidas() {
  var slots = ["desayuno", "almuerzo", "merienda", "cena"];
  var todayMeals = S.meals.filter(function (m) { return m.date === day; });
  var html = "<article class=\"card\"><h3>" + prettyDate(day) + "</h3><div class=\"list\">";
  slots.forEach(function (slot) {
    var found = todayMeals.filter(function (m) { return m.slot === slot; })[0];
    html += "<div class=\"item\"><div class=\"grow\"><div>" + slot + "</div><div class=\"meta\">" + (found ? escapeHtml(found.text) : "sin cargar") + "</div></div><button class=\"chip " + (found && found.good ? "on" : "") + "\" data-act=\"meal\" data-slot=\"" + slot + "\">" + (found ? "editar" : "sumar") + "</button></div>";
  });
  return html + "</div></article>";
}
function screenDiario() {
  var j = S.journal[day] || { facts: "", learned: "", tomorrow: "", morning: "" };
  return "<article class=\"card hero\"><h3>Entrada de manana</h3><div class=\"learned\">" + (j.morning ? escapeHtml(j.morning) : "Se escribe sola cuando cerras la noche.") + "</div></article><article class=\"card\"><h3>Noche</h3><div class=\"form-grid\"><div class=\"field\"><label>Hechos</label><textarea id=\"j-facts\">" + escapeHtml(j.facts) + "</textarea></div><div class=\"field\"><label>Que aprendi</label><textarea id=\"j-learned\">" + escapeHtml(j.learned) + "</textarea></div><div class=\"field\"><label>Manana (max 3)</label><textarea id=\"j-tomorrow\">" + escapeHtml(j.tomorrow) + "</textarea></div><button class=\"btn primary\" data-act=\"save-journal\">Cerrar el dia y sumar puntos</button></div></article>";
}
function screenObjetivos() {
  var open = S.goals.filter(function (g) { return !g.done; });
  var done = S.goals.filter(function (g) { return g.done; });
  var p = S.points[day] || { items: {}, total: 0 };
  var html = "<article class=\"card hero\"><h3>Puntos del mes</h3><div class=\"pts\">" + pointsMonth() + "</div><p>" + level(pointsMonth()) + " · hoy " + (p.total || 0) + "</p></article>";
  html += "<article class=\"card\"><div class=\"between\"><h3>Activos</h3><button class=\"chip\" data-act=\"add-goal\">nuevo</button></div><div class=\"list\">";
  if (!open.length) html += "<div class=\"empty\">Sin objetivos.</div>";
  open.forEach(function (g) { html += "<div class=\"item\"><button class=\"check\" data-act=\"toggle-goal\" data-id=\"" + g.id + "\"></button><div class=\"grow\"><div>" + escapeHtml(g.title) + "</div><div class=\"meta\">" + g.layer + "</div></div></div>"; });
  html += "</div></article>";
  if (done.length) {
    html += "<article class=\"card\"><h3>Hechos</h3><div class=\"list\">";
    done.forEach(function (g) { html += "<div class=\"item\"><button class=\"check on\" data-act=\"toggle-goal\" data-id=\"" + g.id + "\"></button><div class=\"grow\">" + escapeHtml(g.title) + "</div></div>"; });
    html += "</div></article>";
  }
  return html;
}
function screenAjustes() {
  return "<article class=\"card\"><div class=\"form-grid\"><div class=\"field\"><label>Tu nombre</label><input id=\"s-name\" value=\"" + escapeHtml(S.settings.name) + "\" /></div><div class=\"field\"><label>1 USD equivale a (UYU)</label><input id=\"s-rate\" type=\"number\" step=\"0.01\" value=\"" + S.settings.usdRate + "\" /></div><div class=\"field\"><label>Hora ritual de noche</label><input id=\"s-night\" type=\"time\" value=\"" + S.settings.nightHour + "\" /></div><div class=\"field\"><label>Color verde</label><input id=\"s-accent\" type=\"color\" value=\"" + S.settings.accent + "\" /></div><button class=\"btn primary\" data-act=\"save-settings\">Guardar ajustes</button></div></article><article class=\"card\"><h3>Otros aparatos</h3><p class=\"tiny\">Exporta remo.json a iCloud Drive e importalo en el otro aparato.</p><div class=\"actions\"><button class=\"btn\" data-act=\"export\">Exportar</button><button class=\"btn\" data-act=\"import\">Importar</button></div><input id=\"file-import\" type=\"file\" accept=\"application/json\" hidden /></article><button class=\"btn danger wide\" data-act=\"reset\">Borrar todo este aparato</button>";
}
function render() {
  applyAccent(); nav(); titles();
  var screens = { hoy: screenHoy, agenda: screenAgenda, habitos: screenHabitos, plata: screenPlata, gym: screenGym, comidas: screenComidas, diario: screenDiario, objetivos: screenObjetivos, ajustes: screenAjustes };
  $("view").innerHTML = (screens[view] || screenHoy)();
  bind();
}
function bind() {
  var pick = $("pick-day");
  if (pick) pick.addEventListener("change", function () { day = pick.value; render(); });
  document.querySelectorAll("[data-act]").forEach(function (el) {
    el.addEventListener("click", function () { act(el.getAttribute("data-act"), el.dataset); });
  });
}
function act(name, data) {
  if (name === "toggle-habit") {
    var h = S.habits.filter(function (x) { return x.id === data.id; })[0];
    if (!h) return;
    h.done[day] = !h.done[day];
    setPoints(day, { habito: S.habits.filter(function (x) { return x.done[day]; }).length * POINTS.habito });
    save(); render(); return;
  }
  if (name === "add-habit") {
    openSheet("<h2>Nuevo habito</h2><div class=\"form-grid\"><div class=\"field\"><label>Nombre</label><input id=\"f-habit\" /></div><button class=\"btn primary\" id=\"ok-habit\">Guardar</button></div>");
    $("ok-habit").onclick = function () {
      var n = $("f-habit").value.trim();
      if (!n) return;
      S.habits.push({ id: uid(), name: n, done: {} });
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "add-block") {
    openSheet("<h2>Bloque</h2><div class=\"form-grid\"><div class=\"field\"><label>Que</label><input id=\"f-title\" placeholder=\"Estudiar\" /></div><div class=\"grid-2\"><div class=\"field\"><label>Desde</label><input id=\"f-start\" type=\"time\" value=\"09:00\" /></div><div class=\"field\"><label>Hasta</label><input id=\"f-end\" type=\"time\" value=\"10:30\" /></div></div><button class=\"btn primary\" id=\"ok-block\">Guardar</button></div>");
    $("ok-block").onclick = function () {
      S.blocks.push({ id: uid(), title: $("f-title").value.trim() || "Bloque", start: $("f-start").value, end: $("f-end").value, days: [1,2,3,4,5] });
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "del-block") { S.blocks = S.blocks.filter(function (b) { return b.id !== data.id; }); save(); render(); return; }
  if (name === "add-move") {
    var opts = CATS.map(function (c) { return "<option>" + c + "</option>"; }).join("");
    openSheet("<h2>Movimiento</h2><div class=\"form-grid\"><div class=\"field\"><label>Tipo</label><select id=\"f-type\"><option value=\"gasto\">Gasto</option><option value=\"ingreso\">Ingreso</option></select></div><div class=\"field\"><label>Monto UYU</label><input id=\"f-amt\" type=\"number\" /></div><div class=\"field\"><label>Categoria</label><select id=\"f-cat\">" + opts + "</select></div><div class=\"field\"><label>Nota</label><input id=\"f-note\" /></div><button class=\"btn primary\" id=\"ok-move\">Guardar</button></div>");
    $("ok-move").onclick = function () {
      var amount = Number($("f-amt").value);
      if (!amount) return;
      S.moves.push({ id: uid(), date: day, type: $("f-type").value, amount: amount, category: $("f-cat").value, note: $("f-note").value.trim() });
      setPoints(day, { gastos: POINTS.gastos });
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "del-move") { S.moves = S.moves.filter(function (m) { return m.id !== data.id; }); save(); render(); return; }
  if (name === "add-bill") {
    openSheet("<h2>Pago</h2><div class=\"form-grid\"><div class=\"field\"><label>Que</label><input id=\"f-bn\" /></div><div class=\"field\"><label>Monto UYU</label><input id=\"f-ba\" type=\"number\" /></div><div class=\"field\"><label>Vence</label><input id=\"f-bd\" type=\"date\" value=\"" + day + "\" /></div><button class=\"btn primary\" id=\"ok-bill\">Guardar</button></div>");
    $("ok-bill").onclick = function () {
      S.bills.push({ id: uid(), name: $("f-bn").value.trim() || "Pago", amount: Number($("f-ba").value) || 0, due: $("f-bd").value, paid: false });
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "toggle-bill") { var b = S.bills.filter(function (x) { return x.id === data.id; })[0]; if (b) b.paid = !b.paid; save(); render(); return; }
  if (name === "add-gym") {
    openSheet("<h2>Sesion</h2><div class=\"form-grid\"><div class=\"field\"><label>Tipo</label><select id=\"f-gt\"><option>Full body</option><option>Empuje</option><option>Tiron</option><option>Piernas</option><option>Cardio</option></select></div><div class=\"field\"><label>Nota</label><input id=\"f-gn\" /></div><button class=\"btn primary\" id=\"ok-gym\">Hecho</button></div>");
    $("ok-gym").onclick = function () {
      S.gym.push({ id: uid(), date: day, title: $("f-gt").value, note: $("f-gn").value.trim() });
      S.habits.forEach(function (h) { if (/gym/i.test(h.name)) h.done[day] = true; });
      setPoints(day, { gym: POINTS.gym });
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "meal") {
    var slot = data.slot;
    var found = S.meals.filter(function (m) { return m.date === day && m.slot === slot; })[0];
    openSheet("<h2>" + slot + "</h2><div class=\"form-grid\"><div class=\"field\"><label>Que comiste</label><input id=\"f-mt\" value=\"" + (found ? escapeHtml(found.text) : "") + "\" /></div><div class=\"field\"><label>Comida real</label><select id=\"f-mg\"><option value=\"1\">Si</option><option value=\"0\">No tanto</option></select></div><button class=\"btn primary\" id=\"ok-meal\">Guardar</button></div>");
    $("ok-meal").onclick = function () {
      S.meals = S.meals.filter(function (m) { return !(m.date === day && m.slot === slot); });
      S.meals.push({ id: uid(), date: day, slot: slot, text: $("f-mt").value.trim(), good: $("f-mg").value === "1" });
      if (S.meals.filter(function (m) { return m.date === day && m.good; }).length >= 2) {
        S.habits.forEach(function (h) { if (/comer/i.test(h.name)) h.done[day] = true; });
        setPoints(day, { comida: POINTS.comida });
      }
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "save-journal") {
    var facts = $("j-facts").value.trim();
    var learned = $("j-learned").value.trim();
    var tomorrow = $("j-tomorrow").value.trim();
    var morning = learned ? (learned + (tomorrow ? " Manana: " + tomorrow : "")) : tomorrow;
    S.journal[day] = { facts: facts, learned: learned, tomorrow: tomorrow, morning: morning };
    var patch = { noche: POINTS.noche };
    if (learned) patch.aprendio = POINTS.aprendio;
    if (tomorrow) patch.plan = POINTS.plan;
    S.habits.forEach(function (h) { if (/noche/i.test(h.name)) h.done[day] = true; });
    setPoints(day, patch);
    save(); go("hoy"); return;
  }
  if (name === "noche") { go("diario"); return; }
  if (name === "add-goal") {
    openSheet("<h2>Objetivo</h2><div class=\"form-grid\"><div class=\"field\"><label>Texto</label><input id=\"f-goalt\" /></div><div class=\"field\"><label>Capa</label><select id=\"f-goall\"><option value=\"dia\">del dia</option><option value=\"semana\">de la semana</option><option value=\"mes\" selected>del mes</option></select></div><button class=\"btn primary\" id=\"ok-goal\">Guardar</button></div>");
    $("ok-goal").onclick = function () {
      var title = $("f-goalt").value.trim();
      if (!title) return;
      S.goals.push({ id: uid(), title: title, layer: $("f-goall").value, done: false });
      save(); closeSheet(); render();
    };
    return;
  }
  if (name === "toggle-goal") { var g = S.goals.filter(function (x) { return x.id === data.id; })[0]; if (g) g.done = !g.done; save(); render(); return; }
  if (name === "save-settings") {
    S.settings.name = $("s-name").value.trim() || "RAMA";
    S.settings.usdRate = Number($("s-rate").value) || 40;
    S.settings.nightHour = $("s-night").value || "21:30";
    S.settings.accent = $("s-accent").value || "#c6f25c";
    save(); render(); return;
  }
  if (name === "export") {
    var blob = new Blob([JSON.stringify(S, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "rema-" + todayISO() + ".json";
    a.click(); return;
  }
  if (name === "import") { $("file-import").click(); return; }
  if (name === "reset") {
    if (!confirm("Esto borra REMA solo en este aparato.")) return;
    localStorage.removeItem(KEY);
    S = defaultState(); save(); render();
  }
}

document.body.addEventListener("click", function (e) {
  var g = e.target.closest("[data-go]");
  if (g) go(g.getAttribute("data-go"));
});
$("sheet-bg").addEventListener("click", function (e) { if (e.target.id === "sheet-bg") closeSheet(); });
$("btn-more").onclick = function () { go("mas"); };
document.addEventListener("change", function (e) {
  if (e.target.id === "file-import" && e.target.files[0]) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || !data.settings) throw new Error("bad");
        S = Object.assign(defaultState(), data);
        save(); closeSheet(); render();
      } catch (err) { alert("No pude leer ese archivo."); }
    };
    reader.readAsText(e.target.files[0]);
  }
});
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(function () {});
render();
