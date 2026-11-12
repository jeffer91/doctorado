// Mapeo puro: Firestore UTET -> matrículas académicas para Neon.
// No copia nombres, correos, teléfonos, calificaciones ni otros datos personales.
const text = x => String(x ?? "").trim();
const clean = x => text(x).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const pick = (o,keys) => keys.map(k=>o?.[k]).find(v=>v!==undefined && v!==null && text(v)!=="");
export const cedula = (o,id="") => {
  const v = text(pick(o,["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula","Cédula","identificacion","Identificacion"])||id);
  return /^[0-9]{10}$/.test(v) ? v : "";
};
export const periodo = (o,id="") => text(pick(o,["periodoId","periodId","PeriodoId","periodoCanonicoId","ultimoPeriodoId","periodo","Periodo"])||id);
export const carrera = o => text(pick(o,["nombreCarrera","NombreCarrera","carrera","Carrera","nombreCarreraActual"]));
export const sede = o => text(pick(o,["sede","Sede"]));
export function modalidad(v) {
  const t = clean(v);
  if (/articulo academico|articulo de titulacion|articulo cientifico/.test(t)) return "articulo";
  if (/examen complexivo|complexivo/.test(t)) return "complexivo";
  if (/trabajo de titulacion|proyecto de titulacion|tesis/.test(t)) return "trabajo";
  return "";
}
const meta = d => Date.parse(String(d?.updatedAt || d?.actualizado || d?.createdAt || "")) || 0;
export function convertirMatriculas(docs, cedulas, periodosDoc = []) {
  const wanted = new Set(cedulas);
  const catalog = new Map();
  const putPeriod = (id,label,inicio="",fin="") => {
    id=text(id).slice(0,120);
    if (!id) return;
    const prev=catalog.get(id);
    const nombre=text(label||id).slice(0,200);
    if(!prev || prev.nombre===id) catalog.set(id,{periodo_id:id,nombre,inicio:text(inicio).slice(0,80),fin:text(fin).slice(0,80)});
  };
  for(const doc of periodosDoc) {
    const d=doc.data||{};
    const id=periodo(d,doc.id);
    putPeriod(id,pick(d,["label","nombre","periodoLabel","nombrePeriodo"])||id,pick(d,["inicio","fechaInicio"]),pick(d,["fin","fechaFin"]));
  }
  const chosen = new Map();
  for(const doc of docs) {
    const d=doc.data||{};
    const fallback=String(doc.id||"");
    const cut=fallback.lastIndexOf("__");
    const idCedula=cut>=0 ? fallback.slice(cut+2) : "";
    const idPeriodo=cut>=0 ? fallback.slice(0,cut) : "";
    const c=cedula(d,idCedula);
    const p=periodo(d,idPeriodo);
    if(!wanted.has(c)||!p||p.length>120||d.eliminado===true)continue;
    const rec={cedula:c,periodo_id:p,carrera:carrera(d).slice(0,120),
      modalidad:modalidad(pick(d,["modalidadTitulacion","ModalidadTitulacion","tipoTitulacion","modalidad","Modalidad"])),
      sede:sede(d).slice(0,120),fuente:"firebase_utet"};
    const key=c+"|"+p;
    const score=(doc.collection==="matriculas"?100:0)+(rec.carrera?20:0)+(rec.modalidad?10:0)+(rec.sede?5:0);
    const prev=chosen.get(key);
    if(!prev||score>prev.score||(score===prev.score&&meta(d)>prev.updated))chosen.set(key,{rec,score,updated:meta(d)});
    putPeriod(p,p);
  }
  return {periodos:[...catalog.values()],matriculas:[...chosen.values()].map(x=>x.rec)};
}
