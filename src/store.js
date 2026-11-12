// src/store.js — Guardado: Neon (principal) + copias en Firebase y Supabase (respaldo).
import { API, SUPABASE } from "./config.js";
import { firebaseReady, backupSurvey } from "./firebase.js";

export function ready() { return Boolean(API) || firebaseReady(); }

// Devuelve "ok", "dup" (esa cédula ya respondió esta etapa) o lanza error.
async function post(url, row, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(row)
  });
  if (res.ok) return "ok";
  if (res.status === 409) return "dup";
  throw new Error("HTTP " + res.status);
}
const saveNeon = row => post(API + "/respuestas", row);
const saveSupabase = row => post(SUPABASE.url + "/rest/v1/doctorado_respuestas", row,
  { apikey: SUPABASE.key, Authorization: "Bearer " + SUPABASE.key, Prefer: "return=minimal" });

const limit = (promise, ms) => Promise.race([promise, new Promise(r => setTimeout(() => r(false), ms))]);

// Resultado: "ok" (guardada), "dup" (ya había respondido) o lanza error si ninguna base respondió.
export async function submitSurvey(row) {
  let primary = "fail";
  if (API) { try { primary = await saveNeon(row); } catch (e) { console.warn(e); } }
  if (primary === "dup") return "dup";

  // Si la principal ya guardó, las copias no hacen esperar al estudiante más de 8 s.
  const wait = primary === "ok" ? 8000 : 20000;
  const copies = [];
  if (firebaseReady()) copies.push(limit(backupSurvey(row), wait));
  if (SUPABASE.url && SUPABASE.key) copies.push(limit(saveSupabase(row).then(r => r === "ok"), wait));
  const results = await Promise.allSettled(copies);
  results.forEach(r => r.status === "rejected" && console.warn(r.reason));

  if (primary === "ok" || results.some(r => r.status === "fulfilled" && r.value === true)) return "ok";
  // El respaldo no permite sobrescribir: un rechazo ahí significa que ya estaba registrada.
  if (results.some(r => r.status === "rejected" && r.reason?.code === "permission-denied")) return "dup";
  throw new Error("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
}
