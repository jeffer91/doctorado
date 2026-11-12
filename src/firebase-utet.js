// Conexión solo para el panel administrativo: lectura de datos académicos UTET.
// Requiere inicio de sesión de Google con la cuenta autorizada por Firestore.
// Nunca utiliza escrituras ni reglas públicas como sustituto de autenticación.
import { UTET_FIREBASE, ADMIN_EMAIL } from "./config.js";
import { cruzarUtet } from "./utet-map.js";

const SDK = "https://www.gstatic.com/firebasejs/12.6.0/";
let cache = null;
function chunks(items, size = 25) {
  const out = [];
  for (let i=0; i<items.length; i+=size) out.push(items.slice(i,i+size));
  return out;
}
async function sdk() {
  if (!cache) cache = (async () => {
    const [app, firestore, auth] = await Promise.all([
      import(SDK + "firebase-app.js"),
      import(SDK + "firebase-firestore.js"),
      import(SDK + "firebase-auth.js")
    ]);
    const instance = app.getApps().find(x => x.name === "DoctoradoUTET") ||
      app.initializeApp(UTET_FIREBASE, "DoctoradoUTET");
    return { db:firestore.getFirestore(instance), auth:auth.getAuth(instance), f:firestore, a:auth };
  })();
  return cache;
}
async function userReady(s) {
  await s.auth.authStateReady();
  const user = s.auth.currentUser;
  return user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
    user.emailVerified === true ? user : null;
}
export async function sesionUtet() {
  return Boolean(await userReady(await sdk()));
}
export async function conectarUtet() {
  const s = await sdk();
  const old = await userReady(s);
  if (old) return old;
  const provider = new s.a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt:"select_account" });
  const result = await s.a.signInWithPopup(s.auth,provider);
  if (result.user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase() || !result.user.emailVerified) {
    await s.a.signOut(s.auth);
    throw new Error("Debes autorizarte con la cuenta administrativa del ITSQMET.");
  }
  return result.user;
}
export function errorUtet(e) {
  const code = e?.code || "";
  if (code === "permission-denied") return "Firestore denegó la lectura. Revisa las reglas de las colecciones institucionales.";
  if (code === "auth/unauthorized-domain") return "Agrega jeffer91.github.io en los dominios autorizados de Firebase Authentication.";
  if (code === "auth/operation-not-allowed") return "Habilita el proveedor Google en Firebase Authentication.";
  if (code === "auth/popup-blocked") return "Autoriza las ventanas emergentes de Google para vincular Firebase.";
  if (code === "auth/popup-closed-by-user") return "Se canceló el inicio de sesión con Google.";
  return e?.message || "No se pudo leer Firebase UTET.";
}
export async function leerClasificacionesUtet(cedulas, { autenticar = false } = {}) {
  const lista = [...new Set(cedulas)].filter(c => /^\d{10}$/.test(c));
  if (!lista.length) return {filas:[], consultadas:0, encontradas:0, sinCoincidencia:0, documentosLeidos:0, avisos:[]};
  const s = await sdk();
  if (autenticar) await conectarUtet();
  else if (!await userReady(s)) throw new Error("Autoriza primero Firebase UTET desde Configuración.");
  const docs = { Estudiante:[], Estudiantes:[], matriculas:[], EstudiantesPeriodo:[] };
  const avisos = [], operations = [];
  const groups = chunks(lista);
  // Solamente se leen registros asociados a cédulas que respondieron la encuesta.
  for (const collectionName of ["Estudiante","Estudiantes"]) {
    for (const group of groups) operations.push({ collectionName, field:"__name__", ids:group });
  }
  for (const collectionName of ["matriculas","EstudiantesPeriodo"]) {
    for (const field of ["cedula","numeroIdentificacion","Cedula"]) {
      for (const group of groups) operations.push({ collectionName,field,ids:group });
    }
  }
  let cursor = 0, ok = 0;
  const seen = new Set();
  async function worker() {
    while(cursor < operations.length) {
      const op = operations[cursor++];
      try {
        const source = s.f.collection(s.db,op.collectionName);
        const query = s.f.query(source, s.f.where(op.field === "__name__" ? s.f.documentId() : op.field, "in", op.ids));
        const snap = await s.f.getDocs(query);
        ok++;
        for (const doc of snap.docs) {
          const key = op.collectionName + "/" + doc.id;
          if (seen.has(key)) continue;
          seen.add(key);
          docs[op.collectionName].push({ id:doc.id, data:doc.data() });
        }
      } catch(e) {
        const message = errorUtet(e);
        if(!avisos.includes(op.collectionName + ": " + message)) avisos.push(op.collectionName + ": " + message);
      }
    }
  }
  await Promise.all(Array.from({length:Math.min(4,operations.length)},() => worker()));
  if (!ok) throw new Error(avisos.join(" ") || "No fue posible leer las colecciones de UTET.");
  const result = cruzarUtet(lista,docs);
  return { ...result, avisos };
}
