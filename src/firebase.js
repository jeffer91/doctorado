// src/firebase.js — Acceso aislado a datos de las encuestas.
// La configuración pública de Firebase se inyecta en runtime-config.js durante el despliegue.
// Nunca se consulta desde el navegador el padrón privado de estudiantes del ITSQMET.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import { getFirestore, collection, doc, getDocs, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

const firebaseConfig = window.DOCTORADO_FIREBASE_CONFIG;
const configured = Boolean(firebaseConfig?.apiKey && firebaseConfig?.projectId && firebaseConfig?.authDomain && firebaseConfig?.appId);
const app = configured ? initializeApp(firebaseConfig, "DoctoradoEncuestas") : null;
const auth = configured ? getAuth(app) : null;
const db = configured ? getFirestore(app) : null;
const COL = "doctorado_respuestas";

export function ready() { return configured; }
export function currentUser() { return auth?.currentUser || null; }
export function onLoginChange(callback) { return auth ? onAuthStateChanged(auth, callback) : (()=>{}); }
export async function signOutUser() { if (auth) await signOut(auth); }
export async function signInAdmin() {
  assertReady();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({prompt: "select_account"});
  const result = await signInWithPopup(auth, provider);
  return result.user;
}
export function isGoogleUser(user) {
  return Boolean(user?.emailVerified && user?.providerData?.some(x => x.providerId === "google.com"));
}
function assertReady() {
  if (!configured) throw new Error("Falta configurar Firebase en GitHub Actions. Consulta el README de instalación.");
}
async function anonymousSession() {
  assertReady();
  if (auth.currentUser?.isAnonymous) return auth.currentUser;
  if (auth.currentUser) await signOut(auth);
  const result = await signInAnonymously(auth);
  return result.user;
}
async function responseId(stage, cedula) {
  const bytes = new TextEncoder().encode("doctorado-v1|" + stage + "|" + cedula);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, "0")).join("");
}
export async function submitSurvey({stage,cedula,carrera,answers,consent}) {
  if (!consent) throw new Error("Debes aceptar el consentimiento para participar.");
  if (!/^\d{10}$/.test(cedula)) throw new Error("La cédula debe tener diez dígitos.");
  const user = await anonymousSession();
  const id = await responseId(stage, cedula);
  await setDoc(doc(db,COL,id), {
    etapa:stage, cedula, carrera, answers, consent:true,
    schemaVersion:1, anonUid:user.uid, createdAt:serverTimestamp()
  });
  return id;
}
export async function fetchSurveys() {
  assertReady();
  const snapshot = await getDocs(collection(db,COL));
  return snapshot.docs.map(d=>({id:d.id,...d.data(),fecha:d.data().createdAt?.toDate?.()??null}));
}
export function readableError(error) {
  const code = error?.code || "";
  if (code === "permission-denied") return "Acceso rechazado. Verifica las reglas de seguridad. Si ya enviaste esta encuesta, no podrás sobrescribirla.";
  if (code === "auth/operation-not-allowed") return "Habilita los proveedores de autenticación Anónimo y Google en Firebase.";
  if (code === "auth/unauthorized-domain") return "Debes autorizar el dominio de GitHub Pages en Firebase Authentication.";
  if (code === "auth/popup-blocked") return "Permite las ventanas emergentes para iniciar sesión con Google.";
  if (code === "auth/popup-closed-by-user") return "Se cerró la ventana de Google antes de completar el acceso.";
  if (code === "unavailable" || code === "auth/network-request-failed") return "No fue posible conectar con Firebase.";
  return error?.message || "No se pudo completar la operación.";
}
