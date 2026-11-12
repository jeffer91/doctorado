// src/admin.js — Panel privado. Lee de Neon (principal) y revisa el respaldo de Firebase.
import { API, ADMIN_EMAIL } from "./config.js";
import { STAGES, ARTICULO, QUESTIONS, FRECUENCIA, DIFICULTADES } from "./questions.js";
import { firebaseReady, fetchBackup, firebaseError } from "./firebase.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLS = ["codigo", "carrera", "modalidad", "etapa", "created_at", "version", "se1", "se2", "se3", "se4", "se5", "p6", "p7", "horas", "horas_ns", "dificultad", "dificultad_otra", "ia", "omitidas", "origen"];
const COLS_REG = ["codigo", "carrera", "modalidad", "etapa", "created_at", "version", "gusto", "eleccion", "razon_si", "razon_si_otra", "razon_no", "razon_no_otra", "preparacion", "formacion", "dificultad", "dificultad_otra", "apoyo", "apoyo_otra", "aporte_articulo", "aporte_examen", "omitidas", "origen"];
const KEY = "doctorado:admin";
let root = null, rows = [], regs = [], view = "resumen", careerFilter = "", sedeFilter = "", periodoFilter = "", fromDate = "", toDate = "", search = "", msg = "";
let periodosCatalog = [], candidatos = [], syncEstado = {};

const token = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
const setToken = t => { try { t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } };

// Llama a la función de Neon. Lanza un error con .status si la respuesta no es correcta.
async function api(path, body) {
  const headers = {};
  if (token()) headers.Authorization = "Bearer " + token();
  if (body) headers["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw Object.assign(new Error("HTTP " + res.status), { status: res.status });
  return res.json();
}
function frame(inner, dashboard = false) {
  root.innerHTML = '<header class="top"><span></span><img class="logo" src="./assets/logo.webp" alt="ITSQMET" width="720" height="211"><span></span><div class="bar"></div></header>' +
    (dashboard ? '<main class="workspace">' + inner + '</main>' : '<main class="wrap wide"><p class="eyebrow">Administración</p>' + inner + '</main>');
}

export async function renderAdmin(el) {
  root = el;
  if (!API) return frame('<h1>Panel</h1><p class="lead">Falta conectar la base de datos.</p>');
  if (!token()) return login();
  try { await loadRows(); }
  catch (e) {
    if (e.status === 401) { setToken(null); return login("La sesión terminó. Entra de nuevo."); }
    return frame('<h1>Panel</h1><p class="lead">No se pudieron cargar los datos. Recarga la página.</p>');
  }
  panel();

}

function login(error = "") {
  frame('<h1>Panel</h1><form id="login" novalidate>' +
    '<label class="field">Correo<input name="email" type="email" autocomplete="username" value="' + esc(ADMIN_EMAIL) + '" required></label>' +
    '<label class="field">Contraseña<input name="password" type="password" autocomplete="current-password" required></label>' +
    '<p class="err" role="alert"' + (error ? "" : " hidden") + '>' + esc(error) + '</p>' +
    '<button class="btn" type="submit">Entrar</button></form>');
  root.querySelector("#login").addEventListener("submit", async ev => {
    ev.preventDefault();
    const f = new FormData(ev.target), btn = ev.target.querySelector("button");
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      const r = await api("/admin/login", { email: String(f.get("email")).trim(), clave: String(f.get("password")) });
      setToken(r.token);
      renderAdmin(root);
    } catch (e) {
      login(e.status === 401 ? "Correo o contraseña incorrectos." : e.status === 429 ? "Demasiados intentos. Espera 15 minutos." : "No se pudo conectar. Inténtalo de nuevo.");
    }
  });
}

async function loadRows() {
  const [d,p] = await Promise.all([api("/admin/respuestas"), api("/admin/periodos")]);
  rows = d.filas || []; regs = d.regulares || [];
  periodosCatalog = p.periodos || []; candidatos = p.candidatos || [];
  syncEstado = p.estado || {};
  const saved = sessionStorage.getItem("doctorado:periodo") || "";
  if (!periodoFilter && periodosCatalog.some(x => x.id === saved)) periodoFilter = saved;
  if (periodoFilter && !periodosCatalog.some(x => x.id === periodoFilter)) periodoFilter = "";
}

const mean = a => a.length ? a.reduce((x, y) => x + Number(y), 0) / a.length : null;
const fmt = n => n === null ? "—" : n.toFixed(1).replace(".", ",");
function bars(items, max, unit = "") {
  // items: [etiqueta, valor numérico o null, texto]
  return '<div class="bars">' + items.map(([label, value, text]) =>
    '<div class="row"><span>' + esc(label) + '</span><div class="track"><i style="width:' + (value && max ? Math.max(2, Math.round(value / max * 100)) : 0) + '%"></i></div><b>' + esc(text ?? (value ?? 0) + unit) + '</b></div>').join("") + '</div>';
}
const SE = [["se1", "Problema"], ["se2", "Bibliografía"], ["se3", "Metodología"], ["se4", "Análisis"], ["se5", "Redacción"]];

const section = (title, inner) => '<section><h3>' + esc(title) + '</h3>' + inner + '</section>';
const maxOf = d => Math.max(1, ...d.map(x => x[1]));
const dist = (data, k, options, sort = false) => {
  const d = options.map(([code, label]) => [label, data.filter(r => String(r[k]) === String(code)).length]);
  return sort ? d.sort((x, y) => y[1] - x[1]) : d;
};
const vals = (data, k) => data.map(r => r[k]).filter(v => v !== null && v !== undefined);

function chartsArticulo(data) {
  const dif = dist(data, "dificultad", DIFICULTADES, true), ia = dist(data, "ia", FRECUENCIA);
  return section("Autoeficacia · promedio 1–5", bars(SE.map(([k, l]) => { const m = mean(vals(data, k)); return [l, m, fmt(m)]; }), 5)) +
    section("Dificultad principal", bars(dif, maxOf(dif))) +
    section("Uso de IA", bars(ia, maxOf(ia))) +
    section("Horas semanales", '<p class="big">' + fmt(mean(vals(data, "horas"))) + ' <small>promedio · ' + vals(data, "horas").length + ' respuestas</small></p>');
}

// Estudiantes sin la modalidad de artículo: una gráfica por pregunta, en el orden de la encuesta.
const CORTAS = { gusto: "Le hubiera gustado el artículo", eleccion: "Modalidad que habría elegido", razon_si: "Razón para elegirlo", razon_no: "Razón para no elegirlo", dificultad: "Parte más difícil", apoyo: "Apoyo que necesitaría" };
function chartsRegulares(data) {
  const medias = [["preparacion", "Preparación para el artículo"], ["formacion", "La carrera enseñó a investigar"], ["aporte_articulo", "Aporte del artículo"], ["aporte_examen", "Aporte del examen"]];
  return QUESTIONS.regulares.filter(q => CORTAS[q.id]).map(q => {
    const d = dist(data, q.id, q.options, q.type === "choice" && q.id !== "eleccion");
    return section(CORTAS[q.id], bars(d, maxOf(d)));
  }).join("") +
    section("Promedios 1–5", bars(medias.map(([k, l]) => { const m = mean(vals(data, k)); return [l, m, fmt(m)]; }), 5));
}


const NAV = [
  ["General", [["resumen", "Resumen general"]]],
  ["Artículo académico", [["articulo", "Todos los artículos"], ["inicio", "Inicio"], ["proceso", "En proceso"], ["final", "Finalización"]]],
  ["Otras modalidades", [["regulares", "Grupo de comparación"], ["complexivo", "Examen complexivo"], ["trabajo", "Trabajo de titulación"], ["sinmodalidad", "Sin clasificar"]]],
  ["Análisis", [["carreras", "Por carrera"], ["respuestas", "Respuestas"], ["pendientes", "Período pendiente"]]],
  ["Gestión", [["ajustes", "Configuración"]]]
];
const TITLES = {
  resumen: "Resumen general", articulo: "Artículo académico", inicio: "Inicio del artículo",
  proceso: "Artículo en proceso", final: "Artículo finalizado", regulares: "Grupo de comparación",
  complexivo: "Examen complexivo", trabajo: "Trabajo de titulación", sinmodalidad: "Modalidad pendiente",
  carreras: "Análisis por carrera", respuestas: "Registro de respuestas", pendientes: "Respuestas sin período", ajustes: "Configuración"
};
const clasificar = r => r.etapa === "regulares" ? (r.modalidad || "") : "articulo";
const carrera = r => r.carrera || "Sin carrera";
const todas = () => [...rows, ...regs.map(r => ({ ...r, etapa: "regulares" }))].sort((a,b) => String(b.created_at).localeCompare(String(a.created_at)));
const fecha = r => String(r.created_at || "").slice(0, 10);
function filtradas() {
  if (!periodoFilter) return [];
  const q = search.trim().toLowerCase();
  return todas().filter(r =>
    r.periodoId === periodoFilter &&
    (!careerFilter || (careerFilter === "__vacia__" ? !r.carrera : r.carrera === careerFilter)) &&
    (!sedeFilter || (sedeFilter === "__vacia__" ? !r.sede : r.sede === sedeFilter)) &&
    (!fromDate || fecha(r) >= fromDate) && (!toDate || fecha(r) <= toDate) &&
    (!q || String(r.cedula || "").includes(q) || String(r.codigo || "").toLowerCase().includes(q) ||
      carrera(r).toLowerCase().includes(q))
  );
}
function porVista(arr) {
  if (["resumen","carreras","respuestas","pendientes","ajustes"].includes(view)) return arr;
  if (view === "articulo") return arr.filter(r => r.etapa !== "regulares");
  if (["inicio","proceso","final"].includes(view)) return arr.filter(r => r.etapa === view);
  if (view === "regulares") return arr.filter(r => r.etapa === "regulares");
  if (view === "sinmodalidad") return arr.filter(r => r.etapa === "regulares" && !r.modalidad);
  return arr.filter(r => r.etapa === "regulares" && r.modalidad === view);
}
const num = n => '<b>' + n.toLocaleString("es-EC") + '</b>';
const shortDate = d => d ? new Date(d).toLocaleDateString("es-EC") : "—";
function stat(n, label) {
  return '<div class="dash-stat">' + num(n) + '<span>' + esc(label) + '</span></div>';
}
function metricas(data) {
  const art = data.filter(x => x.etapa !== "regulares");
  const reg = data.filter(x => x.etapa === "regulares");
  const uniq = new Set(data.map(r => r.codigo || r.cedula)).size;
  return '<div class="dash-stats">' +
    stat(uniq, "Estudiantes únicos") + stat(data.length, "Respuestas") +
    stat(art.length, "Artículo académico") + stat(reg.length, "Grupo de comparación") + '</div>';
}
function etapaCount(data) {
  const e = [["Inicio","inicio"],["En proceso","proceso"],["Finalización","final"]];
  return section("Avance por etapa del artículo", bars(e.map(([s,k]) => [s, data.filter(x => x.etapa === k).length]), Math.max(1,...e.map(([,k]) => data.filter(x => x.etapa === k).length))));
}
function modalidadCount(data) {
  const reg = data.filter(x => x.etapa === "regulares");
  const e = [["Examen complexivo","complexivo"],["Trabajo de titulación","trabajo"],["Por clasificar",""]];
  return section("Clasificación del grupo de comparación", bars(e.map(([s,k]) => [s, reg.filter(x => (x.modalidad || "") === k).length]), Math.max(1,reg.length))) +
  '<p class="note">La modalidad corresponde a la clasificación administrativa, no a la preferencia declarada en la encuesta.</p>';
}
function tablaCarreras(data) {
  const agrup = new Map();
  for (const r of data) {
    const k = carrera(r);
    if (!agrup.has(k)) agrup.set(k, { name:k, inicio:0, proceso:0, final:0, reg:0, exam:0, trabajo:0 });
    const x = agrup.get(k);
    if (r.etapa === "regulares") {
      x.reg++;
      if (r.modalidad === "complexivo") x.exam++;
      if (r.modalidad === "trabajo") x.trabajo++;
    } else x[r.etapa]++;
  }
  const lines=[...agrup.values()].sort((a,b) => (b.inicio+b.proceso+b.final+b.reg)-(a.inicio+a.proceso+a.final+a.reg) || a.name.localeCompare(b.name, "es"));
  return section("Distribución por carrera",
    '<div class="dash-table-scroll"><table class="dash-table"><thead><tr><th>Carrera</th><th>Inicio</th><th>Proceso</th><th>Final</th><th>Otras modalidades</th><th>Total</th></tr></thead><tbody>' +
    lines.map(x => '<tr><td><button class="link" data-pickcareer="' + esc(x.name === "Sin carrera" ? "__vacia__" : x.name) + '">' + esc(x.name) + '</button></td>' +
      [x.inicio,x.proceso,x.final,x.reg,x.inicio+x.proceso+x.final+x.reg].map(n => '<td class="numeric">' + n + '</td>').join("") + '</tr>').join("") +
    '</tbody></table></div>' +
    (!lines.length ? '<p class="note">No hay registros para estos filtros.</p>' : '') +
    '<p class="note">Cada etapa contestada cuenta como una respuesta. Un mismo estudiante puede aparecer en varias etapas.</p>');
}
function tablaRespuestas(data) {
  return section("Respuestas registradas",
    '<div class="dash-table-scroll"><table class="dash-table"><thead><tr><th>Fecha</th><th>Código</th><th>Carrera</th><th>Proceso</th><th>Modalidad real</th></tr></thead><tbody>' +
    data.slice(0,200).map(r => '<tr><td>' + esc(shortDate(r.created_at)) + '</td><td>' + esc(r.codigo) + '</td><td>' + esc(carrera(r)) +
    '</td><td>' + esc(STAGES[r.etapa]?.label || r.etapa) + '</td><td>' + esc(clasificar(r) || "Sin clasificar") + '</td></tr>').join("") +
    '</tbody></table></div>' +
    (data.length > 200 ? '<p class="note">Se muestran los primeros 200 registros. La exportación incluye todos los resultados filtrados.</p>' : '') +
    (!data.length ? '<p class="note">No hay respuestas con estos filtros.</p>' : ''));
}
function estadoSincronizacion() {
  const ok = syncEstado.estado === "correcto";
  const last = syncEstado.ejecutado_en ? shortDate(syncEstado.ejecutado_en) : "Sin ejecuciones registradas";
  return section("Sincronización automática Firebase UTET → Neon",
    '<p class="note">Estado: <strong>' + esc(ok ? "Sincronizado" : (syncEstado.estado || "Pendiente de configurar")) + '</strong>' +
    ' · Última ejecución: ' + esc(last) + '</p>' +
    '<p class="note">Períodos en Neon: <strong>' + periodosCatalog.length + '</strong> · Matrículas de participantes: <strong>' +
    candidatos.length + '</strong>.</p>' +
    '<p class="note">El servicio está programado en GitHub Actions cada 30 minutos, sin necesidad de abrir este panel. Su ejecución efectiva requiere las credenciales privadas autorizadas de UTET y Neon.</p>' +
    '<p class="note">Las respuestas sin período inequívoco permanecen pendientes para evitar asignaciones incorrectas.</p>');
}
function pendientesSection() {
  const unresolved = todas().filter(r => !r.periodoId);
  const shown = unresolved.slice(0,150);
  const rowsHtml = shown.map(r => {
    const matching = candidatos.filter(c => c.cedula === r.cedula);
    const field = matching.length ?
      '<select aria-label="Período del estudiante">' +
      '<option value="">Seleccione el período</option>' +
      matching.map(c => '<option value="' + esc(c.periodoId) + '">' + esc(
        (periodosCatalog.find(p => p.id === c.periodoId)?.nombre || c.periodoId) +
        (c.carrera ? " · " + c.carrera : "")) + '</option>').join("") + '</select>' +
      '<button class="link" data-assign="' + esc(r.cedula + "|" + r.etapa) + '">Asignar</button>'
      : '<span class="note">Sin matrícula identificada en UTET</span>';
    return '<tr><td>' + esc(r.codigo) + '</td><td>' + esc(STAGES[r.etapa]?.label || r.etapa) +
      '</td><td>' + esc(shortDate(r.created_at)) + '</td><td>' + field + '</td></tr>';
  }).join("");
  return '<div class="dash-stats">' + stat(unresolved.length,"Respuestas pendientes") +
    stat(new Set(unresolved.map(r=>r.cedula)).size,"Estudiantes por revisar") + '</div>' +
    section("Vinculación manual únicamente cuando sea necesaria",
      '<p class="note">Selecciona el período institucional correcto según la matrícula. Solo se muestran períodos documentados en Neon; la operación se guarda con trazabilidad en la base oficial.</p>' +
      '<div class="dash-table-scroll"><table class="dash-table"><thead><tr><th>Código</th><th>Encuesta</th><th>Fecha</th><th>Período verificado</th></tr></thead><tbody>' +
      rowsHtml + '</tbody></table></div>' +
      (unresolved.length > 150 ? '<p class="note">Se muestran los primeros 150 pendientes.</p>' : '') +
      (!unresolved.length ? '<p class="note">No hay encuestas pendientes de asignación.</p>' : ''));
}
function configPanel() {
  const base = location.origin + location.pathname;
  return estadoSincronizacion() + '<div class="dash-two"><div>' +
    section("Exportaciones",
      '<p class="note">Las exportaciones respetan el período y los filtros seleccionados.</p>' +
      '<div class="actions"><button class="btn ghost" data-a="csv">CSV seudonimizado</button>' +
      '<button class="btn ghost" data-a="csvid">CSV con cédula</button></div>') +
    section("Cuenta", '<button class="btn ghost" data-a="pass">Cambiar contraseña</button>') +
    '</div><div>' +
    section("Enlaces de encuestas", '<ul class="links">' +
      Object.entries(STAGES).map(([k,s]) =>
       '<li><span>' + esc(s.label) + '</span><button class="link" data-copy="' + esc(base + "#/" + k +
       (periodoFilter ? "?periodo=" + encodeURIComponent(periodoFilter) : "")) + '">Copiar</button></li>').join("") + '</ul>' +
       '<p class="note">Selecciona primero un período para generar enlaces que lo identifiquen explícitamente.</p>') +
    section("Respaldo de encuestas Firebase", '<button class="btn ghost" data-a="backup"' +
       (firebaseReady() ? "" : " disabled") + '>' +
       (firebaseReady() ? "Revisar respaldo" : "Respaldo aún sin configurar") +
       '</button><p class="note" id="msg">' + esc(msg) + '</p>') + '</div></div>';
}
function panel() {
  const filtered = filtradas(), data = porVista(filtered);
  const active = candidatos.filter(c => c.periodoId === periodoFilter);
  const careers = [...new Set([...active.map(r=>r.carrera),...filtered.map(r=>r.carrera)].filter(Boolean))].sort((a,b) => a.localeCompare(b,"es"));
  const sedes = [...new Set(filtered.map(r => r.sede).filter(Boolean))].sort((a,b) => a.localeCompare(b,"es"));

  const nav = NAV.map(([title,items]) => '<div class="dash-nav-group"><p>' + esc(title) + '</p>' +
    items.map(([key,name]) => '<button class="dash-nav-item' + (view === key ? ' active' : '') + '" data-v="' + key + '"' +
    (view === key ? ' aria-current="page"' : '') + '>' + esc(name) + '</button>').join("") + '</div>').join("");
  const toolbar = '<div class="dash-filters">' +
    '<label class="dash-filter-period"><strong>1. Período académico</strong><select data-filter="periodo" required>' +
    '<option value="">Seleccione un período</option>' +
    periodosCatalog.map(p=>'<option value="' + esc(p.id) + '"' + (periodoFilter === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>').join("") +
    '</select></label>' +
    '<label>Carrera<select data-filter="career"><option value="">Todas las carreras</option><option value="__vacia__"' +
    (careerFilter === "__vacia__" ? ' selected' : '') + '>Sin carrera</option>' +
    careers.map(c => '<option value="' + esc(c) + '"' + (careerFilter === c ? ' selected' : '') + '>' + esc(c) + '</option>').join("") +
    '</select></label>' +
    '<label>Sede<select data-filter="sede"><option value="">Todas las sedes</option><option value="__vacia__"' +
    (sedeFilter === "__vacia__" ? " selected" : "") + '>Sin sede</option>' +
    sedes.map(c => '<option value="' + esc(c) + '"' + (sedeFilter === c ? " selected" : "") + '>' + esc(c) + '</option>').join("") +
    '</select></label>' +
    '<label>Desde<input type="date" data-filter="from" value="' + esc(fromDate) + '"></label>' +
    '<label>Hasta<input type="date" data-filter="to" value="' + esc(toDate) + '"></label>' +
    '<label>Buscar cédula o código<input type="search" data-filter="search" placeholder="Buscar..." value="' + esc(search) + '"></label>' +
    '<button class="btn ghost" data-a="reset">Limpiar filtros</button></div>';
  let body = "";
  if (view === "ajustes") body = configPanel();
  else if (view === "pendientes") body = pendientesSection();
  else if (!periodoFilter) body = estadoSincronizacion() +
    '<p class="lead">Selecciona primero el período académico para consultar estadísticas y filtros.</p>';
  else if (view === "resumen") body = metricas(data) + '<div class="dash-two"><div>' + etapaCount(data) + '</div><div>' + modalidadCount(data) + '</div></div>' +
    estadoSincronizacion() +
    section("Carreras registradas", '<p class="note">' + [...new Set(data.map(carrera).filter(k => k !== "Sin carrera"))].length +
      ' carreras identificadas · ' + data.filter(r => !r.carrera).length + ' respuestas pendientes de clasificar.</p>') +
      '<button class="btn ghost" data-v="carreras">Ver distribución por carrera</button>';
  else if (view === "carreras") body = metricas(data) + tablaCarreras(data);
  else if (view === "respuestas") body = metricas(data) + tablaRespuestas(data);

  else {
    body = metricas(data);
    if (view === "articulo") body += etapaCount(data);
    if (!data.length) body += '<p class="lead">No hay respuestas para esta selección. Revisa los filtros o la clasificación de estudiantes.</p>';
    else if (["articulo","inicio","proceso","final"].includes(view)) body += chartsArticulo(data);
    else body += chartsRegulares(data);
    if (["complexivo","trabajo","sinmodalidad","regulares"].includes(view)) body += '<p class="note">Este desglose depende de que se haya cargado la modalidad real del estudiante en Configuración.</p>';
  }
  const shell =
    '<div class="dashboard"><aside class="dash-sidebar"><p class="dash-brand">Doctorado · ITSQMET</p><nav aria-label="Módulos de administración">' + nav +
    '</nav><button class="dash-nav-item" data-a="out">Cerrar sesión</button></aside>' +
    '<div class="dash-content"><div class="dash-heading"><div><p class="eyebrow">Administración de encuestas</p><h1>' + esc(TITLES[view] || "Resultados") +
    '</h1></div><div class="dash-heading-actions"><button class="link" data-a="reload">Actualizar</button><button class="link" data-a="out">Salir</button></div></div>' +
    toolbar + '<div class="dash-body">' + body + '</div></div></div>';
  frame(shell, true);
  root.querySelector("main").onclick = onClick;
  root.querySelector("main").onchange = onChange;
}
function onChange(ev) {
  const f = ev.target.dataset.filter;
  if (!f) return;
  if (f === "career") careerFilter = ev.target.value;
  else if (f === "sede") sedeFilter = ev.target.value;
  else if (f === "periodo") {
    periodoFilter = ev.target.value;
    sessionStorage.setItem("doctorado:periodo",periodoFilter);
    careerFilter = ""; sedeFilter = ""; fromDate = ""; toDate = ""; search = "";
  }
  else if (f === "from") fromDate = ev.target.value;
  else if (f === "to") toDate = ev.target.value;
  else if (f === "search") search = ev.target.value.trim();
  panel();
}

function say(text) { msg = text; const m = root.querySelector("#msg"); if (m) m.textContent = text; }


async function onClick(ev) {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.v) { view = b.dataset.v; return panel(); }
  if (b.dataset.assign) {
    const [cedula, etapa] = b.dataset.assign.split("|");
    const periodoId = b.closest("tr")?.querySelector("select")?.value;
    if (!periodoId) return alert("Selecciona el período confirmado en UTET.");
    if (!confirm("¿Asociar esta encuesta con el período seleccionado?")) return;
    b.disabled = true;
    try {
      await api("/admin/asignar-periodo",{cedula,etapa,periodoId});
      await loadRows(); panel();
    } catch (error) {
      b.disabled = false;
      alert(error.status === 409 ? "Esa matrícula no coincide con los datos de UTET." : "No se pudo guardar la asignación.");
    }
    return;
  }

  if (b.dataset.pickcareer) { careerFilter = b.dataset.pickcareer; view = "respuestas"; return panel(); }
  if (b.dataset.copy) {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copiado"; }
    catch { prompt("Copia el enlace:", b.dataset.copy); }
    return;
  }
  switch (b.dataset.a) {
    case "out": try { await api("/admin/salir", {}); } catch {} setToken(null); rows = []; regs = [];
      return login();
    case "reload": return renderAdmin(root);
    case "reset": careerFilter = ""; sedeFilter = ""; periodoFilter = ""; fromDate = ""; toDate = ""; search = ""; return panel();

    case "csv": return csv(false);
    case "csvid": return confirm("Este archivo incluye cédulas. Guárdalo en un lugar seguro.") && csv(true);
    case "import": return importar(b);
    case "pass": {
      const p = prompt("Nueva contraseña (mínimo 8 caracteres):");
      if (!p) return;
      if (p.length < 8) return alert("Debe tener al menos 8 caracteres.");
      try { await api("/admin/clave", { nueva: p }); alert("Contraseña actualizada."); }
      catch { alert("No se pudo cambiar la contraseña."); }
      return;
    }
    case "backup": return backup(b);
  }
}
async function importar(b) {
  const raw = root.querySelector("#clasificacion")?.value?.trim() || "";
  const filas = raw.split(/\r?\n/).map(line => line.split(/[;\t,]/).map(s => s.trim()))
    .filter(x => x[0] && /^\d{10}$/.test(x[0]))
    .map(([cedula,carrera,modalidad]) => ({
      cedula, carrera: carrera || "",
      modalidad: ({ examen:"complexivo", "examen complexivo":"complexivo",
        "trabajo de titulacion":"trabajo", "trabajo de titulación":"trabajo",
        "artículo":"articulo" })[(modalidad || "").toLowerCase()] || (modalidad || "").toLowerCase()
    }));
  if (!filas.length) return alert("Pega una lista con cédula y carrera, separadas por punto y coma.");
  const otras = raw.split(/\r?\n/).filter(x => x.trim()).length;
  if (filas.length !== otras && !/c[eé]dula/i.test(raw.split(/\r?\n/)[0])) return alert("Algunas filas no contienen cédulas de 10 dígitos. Corrige el listado.");
  if (filas.some(x => !x.carrera && !x.modalidad)) return alert("Indica al menos la carrera o la modalidad.");
  if (filas.some(x => !["", "articulo", "complexivo", "trabajo"].includes(x.modalidad))) return alert("La modalidad debe ser articulo, complexivo o trabajo.");
  if (filas.length > 500) return alert("Importa hasta 500 estudiantes por lote.");
  if (!confirm("¿Guardar la clasificación de " + filas.length + " estudiantes? Se actualizará la clasificación existente de estas cédulas.")) return;
  b.disabled = true; b.textContent = "Guardando...";
  try {
    const r = await api("/admin/clasificar", { filas });
    await loadRows();
    msg = "Se clasificaron " + r.guardadas + " estudiantes.";
    panel();
    alert(msg);
  } catch (e) {
    b.disabled = false; b.textContent = "Guardar clasificación";
    alert("No se pudo guardar la clasificación (" + (e.status || "conexión") + ").");
  }
}

// Compara Firebase con Neon y recupera en Neon lo que solo esté en el respaldo.
async function backup(b) {
  b.disabled = true; say("Revisando…");
  try {
    const copies = await fetchBackup();
    const have = new Set([...rows.map(r => r.etapa + "|" + r.cedula), ...regs.map(r => "regulares|" + r.cedula)]);
    const missing = copies.filter(x => !have.has(x.etapa + "|" + x.cedula));
    if (!missing.length) return say("Firebase: " + copies.length + " · Neon: " + (rows.length + regs.length) + ". Nada por recuperar.");
    if (!confirm("Hay " + missing.length + " respuesta(s) solo en Firebase. ¿Copiarlas a Neon?")) return say("Faltan " + missing.length + " en Neon.");
    let ok = 0;
    for (let i = 0; i < missing.length; i += 200) ok += (await api("/admin/importar", { filas: missing.slice(i, i + 200) })).guardadas;
    await loadRows(); msg = "Recuperadas " + ok + " de " + missing.length + "."; panel();
  } catch (e) { say(e.status ? "No se pudo copiar a Neon." : firebaseError(e)); }
  finally { b.disabled = false; }
}


function csv(withId) {
  const cols = [...(withId ? ["cedula"] : []), ...new Set([...COLS, ...COLS_REG].filter(x => x !== "cedula"))];
  const cell = v => {
    if (v === null || v === undefined) return "";
    let s = Array.isArray(v) ? v.join("|") : String(v);
    if (typeof v === "string" && /^[=+\-@]/.test(s)) s = "'" + s;
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const data = porVista(filtradas());
  const text = "\ufeff" + [cols.join(","), ...data.map(r => cols.map(k => cell(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = "doctorado_" + view + "_" + new Date().toISOString().slice(0, 10) + (withId ? "_con_cedula" : "") + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
