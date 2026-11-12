// src/firebase.js — Base secundaria (respaldo). Se carga solo cuando se necesita.
import { FIREBASE } from "./config.js";

const V = "https://www.gstatic.com/firebasejs/12.6.0/";
const COL = "doctorado_respuestas";
const CAMPOS = ["se1", "se2", "se3", "se4", "se5", "p6", "p7", "horas", "horas_ns", "dificultad", "dificultad_otra", "ia", "omitidas"];
let cache = null;

export function firebaseReady() {
  return Boolean(FIREBASE?.apiKey && FIREBASE?.projectId && FIREBASE?.authDomain && FIREBASE?.appId);
}
async function sdk() {
  if (!firebaseReady()) throw new Error("Firebase no está configurado.");
  if (!cache) cache = (async () => {
    const [a, f, u] = await Promise.all([import(V + "firebase-app.js"), import(V + "firebase-firestore.js"), import(V + "firebase-auth.js")]);
    const app = a.initializeApp(FIREBASE, "DoctoradoEncuestas");
    return { f, u, db: f.getFirestore(app), auth: u.getAuth(app) };
  })();
  return cache;
}
async function docId(stage, cedula) {
  const bytes = new TextEncoder().encode("doctorado-v2|" + stage + "|" + cedula);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
}

// Guarda una copia de la respuesta. Devuelve true si quedó guardada.
export async function backupSurvey(row) {
  const { f, u, db, auth } = await sdk();
  if (auth.currentUser && !auth.currentUser.isAnonymous) await u.signOut(auth);
  const user = auth.currentUser || (await u.signInAnonymously(auth)).user;
  const r = {};
  for (const k of CAMPOS) r[k] = row[k] ?? null;
  await f.setDoc(f.doc(db, COL, await docId(row.etapa, row.cedula)), {
    etapa: row.etapa, cedula: row.cedula, r, consent: true,
    schemaVersion: 2, anonUid: user.uid, createdAt: f.serverTimestamp()
  });
  return true;
}

// Administrador: lee el respaldo completo (requiere Google autorizado en las reglas).
export async function fetchBackup() {
  const { f, u, db, auth } = await sdk();
  const esGoogle = auth.currentUser?.providerData?.some(x => x.providerId === "google.com");
  if (!esGoogle) {
    if (auth.currentUser) await u.signOut(auth);
    const provider = new u.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await u.signInWithPopup(auth, provider);
  }
  const snap = await f.getDocs(f.query(f.collection(db, COL), f.where("schemaVersion", "==", 2)));
  return snap.docs.map(d => {
    const x = d.data();
    return { etapa: x.etapa, cedula: x.cedula, version: 1, ...x.r, created_at: x.createdAt?.toDate?.().toISOString() };
  });
}

export function firebaseError(error) {
  const code = error?.code || "";
  if (code === "permission-denied") return "Firebase rechazó el acceso. Revisa las reglas y la cuenta de Google.";
  if (code === "auth/operation-not-allowed") return "Habilita los accesos Anónimo y Google en Firebase.";
  if (code === "auth/unauthorized-domain") return "Autoriza jeffer91.github.io en Firebase Authentication.";
  if (code === "auth/popup-blocked") return "Permite las ventanas emergentes para entrar con Google.";
  if (code === "auth/popup-closed-by-user") return "Se cerró la ventana de Google.";
  return error?.message || "No se pudo conectar con Firebase.";
}
