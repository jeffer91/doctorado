// src/admin.js — Panel privado. Lee de Neon (principal) y revisa el respaldo de Firebase.
import { API, ADMIN_EMAIL } from "./config.js";
import { STAGES, FRECUENCIA, DIFICULTADES } from "./questions.js";
import { firebaseReady, fetchBackup, firebaseError } from "./firebase.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLS = ["codigo", "etapa", "created_at", "version", "se1", "se2", "se3", "se4", "se5", "p6", "p7", "horas", "horas_ns", "dificultad", "dificultad_otra", "ia", "omitidas", "origen"];
const KEY = "doctorado:admin";
let root = null, rows = [], filter = "todas", msg = "";

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
function frame(inner) {
  root.innerHTML = '<header class="top"><span></span><span class="brand">ITSQMET · Administración</span><span></span></header><main class="wrap wide">' + inner + '</main>';
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

async function loadRows() { rows = (await api("/admin/respuestas")).filas; }

const mean = a => a.length ? a.reduce((x, y) => x + Number(y), 0) / a.length : null;
const fmt = n => n === null ? "—" : n.toFixed(1).replace(".", ",");
function bars(items, max, unit = "") {
  // items: [etiqueta, valor numérico o null, texto]
  return '<div class="bars">' + items.map(([label, value, text]) =>
    '<div class="row"><span>' + esc(label) + '</span><div class="track"><i style="width:' + (value && max ? Math.max(2, Math.round(value / max * 100)) : 0) + '%"></i></div><b>' + esc(text ?? (value ?? 0) + unit) + '</b></div>').join("") + '</div>';
}
const SE = [["se1", "Problema"], ["se2", "Bibliografía"], ["se3", "Metodología"], ["se4", "Análisis"], ["se5", "Redacción"]];

function panel() {
  const data = filter === "todas" ? rows : rows.filter(r => r.etapa === filter);
  const count = k => rows.filter(r => r.etapa === k).length;
  const vals = k => data.map(r => r[k]).filter(v => v !== null && v !== undefined);
  const dist = (k, options) => options.map(([code, label]) => [label, data.filter(r => String(r[k]) === String(code)).length]);
  const maxOf = d => Math.max(1, ...d.map(x => x[1]));
  const dif = dist("dificultad", DIFICULTADES).sort((a, b) => b[1] - a[1]);
  const ia = dist("ia", FRECUENCIA);
  const base = location.origin + location.pathname;

  frame('<div class="head"><h1>Resultados</h1><button class="link" data-a="out">Salir</button></div>' +
    '<div class="tiles">' +
    '<button class="tile' + (filter === "todas" ? " on" : "") + '" data-f="todas"><b>' + rows.length + '</b><span>Total</span></button>' +
    Object.entries(STAGES).map(([k, s]) => '<button class="tile' + (filter === k ? " on" : "") + '" data-f="' + k + '"><b>' + count(k) + '</b><span>' + esc(s.label) + '</span></button>').join("") +
    '</div>' +
    (data.length ? (
      '<section><h3>Autoeficacia · promedio 1–5</h3>' + bars(SE.map(([k, l]) => { const m = mean(vals(k)); return [l, m, fmt(m)]; }), 5) + '</section>' +
      '<section><h3>Dificultad principal</h3>' + bars(dif, maxOf(dif)) + '</section>' +
      '<section><h3>Uso de IA</h3>' + bars(ia, maxOf(ia)) + '</section>' +
      '<section><h3>Horas semanales</h3><p class="big">' + fmt(mean(vals("horas"))) + ' <small>promedio · ' + vals("horas").length + ' respuestas</small></p></section>'
    ) : '<p class="lead">Aún no hay respuestas.</p>') +
    '<section><h3>Exportar</h3><div class="actions">' +
    '<button class="btn ghost" data-a="csv">CSV seudonimizado</button>' +
    '<button class="btn ghost" data-a="csvid">CSV con cédula</button></div></section>' +
    '<section><h3>Respaldo Firebase</h3><div class="actions"><button class="btn ghost" data-a="backup"' + (firebaseReady() ? "" : " disabled") + '>' + (firebaseReady() ? "Revisar respaldo" : "Firebase sin configurar") + '</button></div>' +
    '<p class="note" id="msg">' + esc(msg) + '</p></section>' +
    '<section><h3>Enlaces</h3><ul class="links">' +
    Object.entries(STAGES).map(([k, s]) => '<li><span>' + esc(s.label) + '</span><button class="link" data-copy="' + esc(base + "#/" + k) + '">Copiar</button></li>').join("") +
    '</ul></section>' +
    '<p class="foot"><button class="link" data-a="pass">Cambiar contraseña</button> · <button class="link" data-a="reload">Actualizar</button></p>');
  root.querySelector("main").onclick = onClick;
}

function say(text) { msg = text; const m = root.querySelector("#msg"); if (m) m.textContent = text; }

async function onClick(ev) {
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.f) { filter = b.dataset.f; return panel(); }
  if (b.dataset.copy) {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copiado"; }
    catch { prompt("Copia el enlace:", b.dataset.copy); }
    return;
  }
  switch (b.dataset.a) {
    case "out": try { await api("/admin/salir", {}); } catch { /* sesión ya cerrada */ } setToken(null); rows = []; return login();
    case "reload": return renderAdmin(root);
    case "csv": return csv(false);
    case "csvid": return confirm("Este archivo incluye cédulas. Guárdalo en un lugar seguro.") && csv(true);
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

// Compara Firebase con Neon y recupera en Neon lo que solo esté en el respaldo.
async function backup(b) {
  b.disabled = true; say("Revisando…");
  try {
    const copies = await fetchBackup();
    const have = new Set(rows.map(r => r.etapa + "|" + r.cedula));
    const missing = copies.filter(x => !have.has(x.etapa + "|" + x.cedula));
    if (!missing.length) return say("Firebase: " + copies.length + " · Neon: " + rows.length + ". Nada por recuperar.");
    if (!confirm("Hay " + missing.length + " respuesta(s) solo en Firebase. ¿Copiarlas a Neon?")) return say("Faltan " + missing.length + " en Neon.");
    let ok = 0;
    for (let i = 0; i < missing.length; i += 200) ok += (await api("/admin/importar", { filas: missing.slice(i, i + 200) })).guardadas;
    await loadRows(); msg = "Recuperadas " + ok + " de " + missing.length + "."; panel();
  } catch (e) { say(e.status ? "No se pudo copiar a Neon." : firebaseError(e)); }
  finally { b.disabled = false; }
}

function csv(withId) {
  const cols = withId ? ["cedula", ...COLS] : COLS;
  const cell = v => {
    if (v === null || v === undefined) return "";
    let s = Array.isArray(v) ? v.join("|") : String(v);
    if (typeof v === "string" && /^[=+\-@]/.test(s)) s = "'" + s; // evita fórmulas al abrir en Excel
    return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const data = filter === "todas" ? rows : rows.filter(r => r.etapa === filter);
  const text = "﻿" + [cols.join(","), ...data.map(r => cols.map(k => cell(r[k])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  a.download = "doctorado_" + filter + "_" + new Date().toISOString().slice(0, 10) + (withId ? "_con_cedula" : "") + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
