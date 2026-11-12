// src/store.js — Guardado en dos bases: Supabase (principal) y Firebase (respaldo).
import { SUPABASE } from "./config.js";
import { firebaseReady, backupSurvey } from "./firebase.js";

export function supabaseReady() { return Boolean(SUPABASE.url && SUPABASE.key); }
export function ready() { return supabaseReady() || firebaseReady(); }

async function savePrimary(row) {
  if (!supabaseReady()) return "off";
  const res = await fetch(SUPABASE.url + "/rest/v1/doctorado_respuestas", {
    method: "POST",
    headers: {
      apikey: SUPABASE.key, Authorization: "Bearer " + SUPABASE.key,
      "Content-Type": "application/json", Prefer: "return=minimal"
    },
    body: JSON.stringify(row)
  });
  if (res.ok) return "ok";
  if (res.status === 409) return "dup"; // ya existe una respuesta de esta cédula en esta etapa
  throw new Error("Supabase " + res.status);
}

// Resultado: "ok" (guardada), "dup" (ya había respondido) o lanza error si ninguna base respondió.
export async function submitSurvey(row) {
  let primary = "fail";
  try { primary = await savePrimary(row); } catch (e) { console.warn(e); }
  if (primary === "dup") return "dup";

  let backup = false;
  if (firebaseReady()) {
    // Si la principal ya guardó, el respaldo no hace esperar al estudiante más de 8 s.
    const limite = new Promise(r => setTimeout(() => r(false), primary === "ok" ? 8000 : 20000));
    try { backup = await Promise.race([backupSurvey(row), limite]); }
    catch (e) {
      // El respaldo no permite sobrescribir: si ya existía y la principal falló, ya estaba registrada.
      if (e?.code === "permission-denied" && primary !== "ok" && !supabaseReady()) return "dup";
      console.warn(e);
    }
  }
  if (primary === "ok" || backup) return "ok";
  throw new Error("No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.");
}
