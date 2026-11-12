// src/config.js — Configuración pública (estos valores no son secretos).
// Base principal: Supabase. Base secundaria (respaldo): Firebase.
export const SUPABASE = {
  url: "",
  key: ""
};

// Firebase: se toma del secreto FIREBASE_WEB_CONFIG de GitHub Actions
// (runtime-config.js) o, si no existe, del objeto FIREBASE_FIJO de abajo.
const FIREBASE_FIJO = null;
export const FIREBASE = globalThis.DOCTORADO_FIREBASE_CONFIG || FIREBASE_FIJO;

export const ADMIN_EMAIL = "jeffersonvillarreal91@gmail.com";
