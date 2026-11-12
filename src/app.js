// src/app.js — Tres encuestas (inicio, proceso, final) y acceso al panel.
import { STAGES, ALIASES, QUESTIONS, cedulaValida, toRow } from "./questions.js";
import { ready, submitSurvey } from "./store.js";

const root = document.getElementById("app");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const NR = "NR", NS = "NS";
let st = null; // estado de la encuesta en curso

function route() {
  const r = (location.hash.replace(/^#\/?/, "").split("?")[0] || "").toLowerCase();
  return ALIASES[r] || r;
}
const key = stage => "doctorado:" + stage;
function save() { try { sessionStorage.setItem(key(st.stage), JSON.stringify(st)); } catch { /* sin almacenamiento */ } }
function load(stage) {
  try {
    const d = JSON.parse(sessionStorage.getItem(key(stage)));
    if (d && d.stage === stage) return d;
  } catch { /* sin almacenamiento */ }
  return { stage, step: -1, cedula: "", consent: false, answers: {}, done: null };
}
function clear(stage) { try { sessionStorage.removeItem(key(stage)); } catch { /* sin almacenamiento */ } }

function page(inner, { progress = null, back = false } = {}) {
  root.innerHTML =
    '<div class="bar"><i style="width:' + (progress === null ? 0 : Math.round(progress * 100)) + '%"></i></div>' +
    '<header class="top">' + (back ? '<button class="back" data-act="back" aria-label="Atrás">←</button>' : '<span></span>') +
    '<span class="brand">ITSQMET · Titulación</span><span></span></header>' +
    '<main class="wrap">' + inner + '</main>';
  root.querySelector("h1,h2")?.focus?.();
  window.scrollTo(0, 0);
}

function home() {
  st = null;
  page('<h1 tabindex="-1">Encuesta de titulación</h1><p class="lead">Elige tu etapa.</p><div class="list">' +
    Object.entries(STAGES).map(([k, s]) => '<a class="opt" href="#/' + k + '">' + esc(s.title) + '<span>→</span></a>').join("") + '</div>');
}

function labelOf(q, v) {
  if (v === NR) return "Prefiero no responder";
  if (q.type === "hours") return v === NS ? "No sé" : v + " h";
  const o = q.options.find(x => String(x[0]) === String(v));
  if (q.id === "dificultad" && v === "otra" && st.answers.dificultad_otra) return "Otra: " + st.answers.dificultad_otra;
  return o ? o[1] : "";
}

function start() {
  const s = STAGES[st.stage];
  if (!ready()) return page('<h1 tabindex="-1">' + esc(s.title) + '</h1><p class="lead">La encuesta no está disponible por ahora.</p>');
  page('<p class="eyebrow">Encuesta · ' + esc(s.label) + '</p><h1 tabindex="-1">' + esc(s.title) + '</h1>' +
    '<p class="lead">10 preguntas · 3 minutos.</p>' +
    '<form data-form="start" novalidate><label class="field">Cédula<input name="cedula" inputmode="numeric" autocomplete="off" maxlength="10" pattern="[0-9]{10}" placeholder="10 dígitos" value="' + esc(st.cedula) + '" required></label>' +
    '<p class="note">Participar es voluntario y no afecta tus notas ni tu titulación. Tus respuestas se usan solo para investigación; tu cédula se guarda protegida para vincular datos académicos.</p>' +
    '<label class="check"><input type="checkbox" name="consent"' + (st.consent ? " checked" : "") + '><span>Acepto participar</span></label>' +
    '<p class="err" role="alert" hidden></p><button class="btn" type="submit">Comenzar</button></form>');
}

function question() {
  const qs = QUESTIONS[st.stage], q = qs[st.step], v = st.answers[q.id];
  let body = "";
  if (q.type === "hours") {
    body = '<form data-form="hours" novalidate><label class="field">Horas por semana<input name="horas" type="number" inputmode="decimal" min="0" max="100" step="0.5" value="' + (v !== undefined && v !== NS && v !== NR ? esc(v) : "") + '"></label>' +
      '<p class="err" role="alert" hidden></p><button class="btn" type="submit">Continuar</button></form>' +
      '<button class="opt slim' + (v === NS ? " on" : "") + '" data-val="' + NS + '">No sé</button>';
  } else {
    body = '<div class="list" role="group">' + q.options.map(o =>
      '<button class="opt' + (String(v) === String(o[0]) ? " on" : "") + '" data-val="' + esc(o[0]) + '">' +
      (q.type === "scale" ? '<b>' + o[0] + '</b>' : "") + '<em>' + esc(o[1]) + '</em></button>').join("") + '</div>';
    if (q.id === "dificultad" && v === "otra") {
      body += '<form data-form="otra"><label class="field">¿Cuál? (opcional)<input name="otra" maxlength="200" value="' + esc(st.answers.dificultad_otra || "") + '"></label><button class="btn" type="submit">Continuar</button></form>';
    }
  }
  page('<p class="eyebrow">' + (st.step + 1) + ' de ' + qs.length + '</p><h2 tabindex="-1">' + esc(q.text) + '</h2>' + body +
    '<button class="skip' + (v === NR ? " on" : "") + '" data-val="' + NR + '">Prefiero no responder</button>',
    { progress: st.step / qs.length, back: true });
}

function review() {
  const qs = QUESTIONS[st.stage];
  page('<p class="eyebrow">Revisa y envía</p><h2 tabindex="-1">Tus respuestas</h2><ol class="review">' +
    qs.map((q, i) => '<li><button data-go="' + i + '"><span>' + esc(q.text) + '</span><strong>' + esc(labelOf(q, st.answers[q.id])) + '</strong></button></li>').join("") +
    '</ol><p class="err" role="alert" hidden></p><button class="btn" data-act="send">Enviar</button>',
    { progress: 1, back: true });
}

function done() {
  const d = st.done;
  page('<div class="done"><div class="tick" aria-hidden="true">✓</div><h1 tabindex="-1">' + (d.dup ? "Ya respondiste" : "Gracias") + '</h1>' +
    '<p class="lead">' + (d.dup ? "Ya tenemos tu respuesta de esta etapa." : "Tu respuesta quedó registrada.") + '</p>' +
    '<p class="note">' + esc(STAGES[st.stage].label) + ' · ' + esc(d.at) + '</p></div>', { progress: 1 });
}

function render() {
  if (!st) return;
  if (st.done) return done();
  if (st.step < 0) return start();
  if (st.step >= QUESTIONS[st.stage].length) return review();
  question();
}
function go(step) { st.step = step; save(); render(); }
function showErr(msg) { const e = root.querySelector(".err"); if (e) { e.textContent = msg; e.hidden = false; } }
// Tras responder, vuelve a la revisión si el estudiante estaba editando.
function next() {
  const qs = QUESTIONS[st.stage];
  const pendiente = qs.findIndex((q, i) => i > st.step && st.answers[q.id] === undefined);
  go(st.editing ? (pendiente === -1 ? qs.length : pendiente) : st.step + 1);
}

root.addEventListener("click", async ev => {
  if (!st) return;
  const b = ev.target.closest("button");
  if (!b) return;
  if (b.dataset.act === "back") { st.editing = false; return go(st.step - 1); }
  if (b.dataset.go !== undefined) { st.editing = true; return go(+b.dataset.go); }
  if (b.dataset.val !== undefined) {
    const q = QUESTIONS[st.stage][st.step];
    st.answers[q.id] = b.dataset.val;
    if (q.id === "dificultad" && b.dataset.val !== "otra") delete st.answers.dificultad_otra;
    save();
    if (q.id === "dificultad" && b.dataset.val === "otra") return render();
    root.querySelectorAll("[data-val]").forEach(x => x.classList.toggle("on", x === b));
    return setTimeout(next, 160);
  }
  if (b.dataset.act === "send") {
    if (b.disabled) return;
    b.disabled = true; b.textContent = "Enviando…";
    try {
      const result = await submitSurvey(toRow(st.stage, st.cedula, st.answers));
      const at = new Date().toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
      const stage = st.stage;
      st = { stage, done: { dup: result === "dup", at } };
      clear(stage);
      render();
    } catch (e) {
      b.disabled = false; b.textContent = "Reintentar";
      showErr(e.message || "No se pudo guardar. Inténtalo de nuevo.");
    }
  }
});

root.addEventListener("submit", ev => {
  if (!st) return;
  const f = ev.target.closest("form[data-form]");
  if (!f) return;
  ev.preventDefault();
  const data = new FormData(f);
  if (f.dataset.form === "start") {
    const cedula = String(data.get("cedula") || "").replace(/\D/g, "");
    if (!cedulaValida(cedula)) return showErr("Revisa tu cédula: deben ser 10 dígitos válidos.");
    if (!data.get("consent")) return showErr("Marca «Acepto participar» para continuar.");
    st.cedula = cedula; st.consent = true;
    return go(0);
  }
  if (f.dataset.form === "hours") {
    const raw = String(data.get("horas") || "").replace(",", ".").trim();
    const n = Number(raw);
    if (raw === "" || !Number.isFinite(n) || n < 0 || n > 100) return showErr("Escribe un número entre 0 y 100, o elige «No sé».");
    st.answers.horas = String(Math.round(n * 10) / 10);
    return next();
  }
  if (f.dataset.form === "otra") {
    st.answers.dificultad_otra = String(data.get("otra") || "").trim().slice(0, 200);
    return next();
  }
});

async function router() {
  const r = route();
  if (r === "admin") {
    st = null;
    root.innerHTML = '<main class="wrap"><p class="lead">Cargando…</p></main>';
    const { renderAdmin } = await import("./admin.js");
    return renderAdmin(root);
  }
  if (STAGES[r]) { st = load(r); return render(); }
  home();
}
window.addEventListener("hashchange", router);
router();
