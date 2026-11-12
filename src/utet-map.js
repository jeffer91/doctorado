// Datos de Firebase UTET -> clasificación académica de las encuestas.
// Solo transforma carrera, sede, período y modalidad; excluye datos de contacto.
const txt = v => String(v ?? "").trim();
const norm = v => txt(v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function cedulaDe(row, id = "") {
  const value = row?.cedula || row?.numeroIdentificacion || row?.NumeroIdentificacion ||
    row?.identificacion || row?.Identificacion || row?.Cedula || row?.["Cédula"] || id;
  const cedula = txt(value).replace(/[\s-]/g, "");
  return /^\d{10}$/.test(cedula) ? cedula : "";
}
function periodoDe(d) {
  return txt(d.periodoId || d.periodId || d.periodoCanonicoId || d.ultimoPeriodoId ||
    d.idPeriodo || d.PeriodoId || d.Periodo || d.periodo || "");
}
function carreraDe(d) {
  return txt(d.nombreCarrera || d.NombreCarrera || d.nombreCarreraActual ||
    d.Carrera || d.carrera || d.nombre_carrera || "");
}
function sedeDe(d) { return txt(d.sede || d.Sede); }
function fechaDe(v) {
  if (typeof v?.toDate === "function") return v.toDate().getTime();
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  const dt = Date.parse(v);
  return Number.isFinite(dt) ? dt : 0;
}
function periodoRank(s) {
  const t = norm(s);
  const years = [...t.matchAll(/(?:19|20)\d{2}/g)].map(x => +x[0]);
  if (!years.length) return 0;
  const year = Math.max(...years);
  const months = [["enero",1],["febrero",2],["marzo",3],["abril",4],["mayo",5],
    ["junio",6],["julio",7],["agosto",8],["septiembre",9],["setiembre",9],
    ["octubre",10],["noviembre",11],["diciembre",12]];
  let month = 0;
  for (const [name,num] of months) if (t.includes(name)) month = Math.max(month,num);
  return year * 12 + month;
}
export function modalidadDe(value) {
  const t = norm(value);
  if (!t) return "";
  if (/articulo|paper|publicacion/.test(t)) return "articulo";
  if (/complexivo|examen de grado|examen final/.test(t)) return "complexivo";
  if (/trabajo de titulacion|proyecto de titulacion|proyecto de grado|tesis/.test(t)) return "trabajo";
  return "";
}
function modality(d) {
  return modalidadDe(d.modalidadTitulacion || d.ModalidadTitulacion ||
    d.tipoTitulacion || d.TipoTitulacion || d.modalidadGraduacion ||
    d.ModalidadGraduacion || d.modalidad || d.Modalidad || "");
}
function identity(doc) {
  const d = doc.data || {};
  const fallback = txt(doc.id).split("__");
  const cedula = cedulaDe(d, /^\d{10}$/.test(doc.id) ? doc.id : fallback[fallback.length - 1]);
  return { cedula, periodoId: periodoDe(d) || (fallback.length > 1 ? fallback.slice(0,-1).join("__") : "") };
}
function newer(a,b) {
  const pA = periodoRank(a.periodoId), pB = periodoRank(b.periodoId);
  if (pA !== pB) return pA > pB;
  if (a.update !== b.update) return a.update > b.update;
  return a.official > b.official;
}
// docs = { Estudiante:[{id,data}], matriculas:[...], Estudiantes:[...], EstudiantesPeriodo:[...] }
export function cruzarUtet(cedulas, docs) {
  const buscadas = new Set([...cedulas].filter(c => /^\d{10}$/.test(c)));
  const personas = new Map(), matriculas = new Map();
  let vistas = 0;
  for (const [coleccion, lista] of Object.entries(docs || {})) {
    const esMatricula = coleccion === "matriculas" || coleccion === "EstudiantesPeriodo";
    const esPersona = coleccion === "Estudiante" || coleccion === "Estudiantes";
    if (!esPersona && !esMatricula) continue;
    for (const doc of lista || []) {
      vistas++;
      const d = doc.data || {};
      const { cedula, periodoId } = identity(doc);
      if (!buscadas.has(cedula) || d.eliminado === true) continue;
      const value = { cedula, periodoId, carrera: carreraDe(d), modalidad: modality(d),
        sede: sedeDe(d), update: fechaDe(d.updatedAt || d.createdAt),
        official: coleccion === "matriculas" || coleccion === "Estudiante" ? 1 : 0 };
      const map = esMatricula ? matriculas : personas;
      const prev = map.get(cedula);
      if (!prev || newer(value,prev)) map.set(cedula,value);
    }
  }
  const filas = [];
  for (const cedula of buscadas) {
    const m = matriculas.get(cedula), p = personas.get(cedula);
    if (!m && !p) continue;
    const carrera = (m?.carrera || p?.carrera || "").slice(0,120);
    const modalidad = m?.modalidad || "";
    if (!carrera && !modalidad) continue;
    filas.push({ cedula, carrera, modalidad,
      sede: (m?.sede || p?.sede || "").slice(0,120),
      periodoId: (m?.periodoId || "").slice(0,120), fuente:"firebase_utet" });
  }
  return { filas, consultadas: buscadas.size, encontradas: new Set([...personas.keys(),...matriculas.keys()]).size,
    sinCoincidencia: buscadas.size - new Set([...personas.keys(),...matriculas.keys()]).size,
    documentosLeidos: vistas };
}
