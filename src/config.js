// src/config.js — Configuración pública (estos valores no son secretos).
// Base principal: Neon (a través de la función "encuestas").
export const API = "https://br-patient-brook-bbpe3q2h-encuestas.compute.c-15.us-east-1.aws.neon.tech";

// Respaldo 1: Firebase. Se toma del secreto FIREBASE_WEB_CONFIG de GitHub Actions
// (runtime-config.js) o, si no existe, del objeto FIREBASE_FIJO de abajo.
const FIREBASE_FIJO = null;
export const FIREBASE = globalThis.DOCTORADO_FIREBASE_CONFIG || FIREBASE_FIJO;

// Respaldo 2 (opcional): Supabase. Vacío = desactivado.
export const SUPABASE = { url: "", key: "" };

export const ADMIN_EMAIL = "jeffersonvillarreal91@gmail.com";


// Proyecto Firebase UTET (app Requisitos). Configuración WEB pública; no es una credencial
// administrativa. El acceso a Firestore requiere Google Auth y reglas restrictivas.
export const UTET_FIREBASE = Object.freeze({
  apiKey: "AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA",
  authDomain: "utet-4387a.firebaseapp.com",
  projectId: "utet-4387a",
  storageBucket: "utet-4387a.firebasestorage.app",
  messagingSenderId: "902848131454",
  appId: "1:902848131454:web:47f515eb6480834724c32f"
});
