// Sincronización automática solo servidor. Node 24, sin dependencias externas.
// Requiere secretos de Actions: FIREBASE_UTET_SERVICE_ACCOUNT_JSON y NEON_DATABASE_URL.
import { createSign } from "node:crypto";
import { convertirMatriculas } from "./utet-normalizar.mjs";

const PROJECT = "utet-4387a";
const BASE = "https://firestore.googleapis.com/v1/projects/"+PROJECT+"/databases/(default)/documents";
const DB_URL = process.env.NEON_DATABASE_URL || "";
const SA = process.env.FIREBASE_UTET_SERVICE_ACCOUNT_JSON || "";
const CHUNK=30;
const timeout=ms=>AbortSignal.timeout(ms);
function value(v) {
  if(v == null)return null;
  if("stringValue" in v)return v.stringValue;
  if("integerValue" in v)return Number(v.integerValue);
  if("doubleValue" in v)return v.doubleValue;
  if("booleanValue" in v)return v.booleanValue;
  if("timestampValue" in v)return v.timestampValue;
  if("nullValue" in v)return null;
  if("mapValue" in v)return Object.fromEntries(Object.entries(v.mapValue.fields||{}).map(([k,x])=>[k,value(x)]));
  if("arrayValue" in v)return (v.arrayValue.values||[]).map(value);
  return null;
}
function unpack(doc,collection) {
  const data=Object.fromEntries(Object.entries(doc.fields||{}).map(([k,v])=>[k,value(v)]));
  data.updatedAt ||= doc.updateTime||"";
  return {id:decodeURIComponent(doc.name.split("/").at(-1)),collection,data};
}
async function json(url,opt={}) {
  const r=await fetch(url,{...opt,signal:timeout(30000)});
  if(!r.ok)throw Error("HTTP "+r.status+" en "+new URL(url).pathname);
  return r.json();
}
function jwt(sa) {
  const enc=obj=>Buffer.from(JSON.stringify(obj)).toString("base64url");
  const now=Math.floor(Date.now()/1000);
  const h=enc({alg:"RS256",typ:"JWT"});
  const p=enc({iss:sa.client_email,sub:sa.client_email,
    scope:"https://www.googleapis.com/auth/datastore",
    aud:"https://oauth2.googleapis.com/token",iat:now,exp:now+3600});
  const unsigned=h+"."+p;
  const sig=createSign("RSA-SHA256").update(unsigned).end().sign(sa.private_key).toString("base64url");
  return unsigned+"."+sig;
}
async function auth() {
  const account=JSON.parse(SA);
  if(account.project_id!==PROJECT||!account.client_email||!account.private_key)throw Error("La cuenta de servicio no pertenece a UTET.");
  const payload=new URLSearchParams({grant_type:"urn:ietf:params:oauth:grant-type:jwt-bearer",assertion:jwt(account)});
  const out=await json("https://oauth2.googleapis.com/token",{method:"POST",
    headers:{"content-type":"application/x-www-form-urlencoded"},body:payload});
  if(!out.access_token)throw Error("No se obtuvo token Google.");
  return out.access_token;
}
async function firestore(token,route,body) {
  return json(BASE+route,{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(body)});
}
async function listPeriods(token) {
  const fields=["periodoId","periodId","PeriodoId","label","nombre","periodoLabel","inicio","fin","fechaInicio","fechaFin"];
  const rows=await firestore(token,":runQuery",{structuredQuery:{from:[{collectionId:"periodos"}],
    select:{fields:fields.map(fieldPath=>({fieldPath}))}}});
  return rows.filter(x=>x.document).map(x=>unpack(x.document,"periodos"));
}
async function enrollmentQuery(token, collection, field, group) {
  const fields=["cedula","numeroIdentificacion","NumeroIdentificacion","Cedula","Cédula","periodoId","periodId",
    "PeriodoId","periodoCanonicoId","ultimoPeriodoId","periodo","Periodo","nombreCarrera","NombreCarrera",
    "carrera","Carrera","modalidadTitulacion","ModalidadTitulacion","tipoTitulacion","modalidad",
    "Modalidad","sede","Sede","eliminado","updatedAt","createdAt"];
  return firestore(token,":runQuery",{structuredQuery:{
    from:[{collectionId:collection}],
    select:{fields:fields.map(fieldPath=>({fieldPath}))},
    where:{fieldFilter:{field:{fieldPath:field},op:"IN",
      value:{arrayValue:{values:group.map(stringValue=>({stringValue}))}}}}
  }});
}
async function matriculasFirestore(token,cedulas) {
  const seen=new Map(), groups=[];
  for(let i=0;i<cedulas.length;i+=CHUNK)groups.push(cedulas.slice(i,i+CHUNK));
  for(const collection of ["matriculas","EstudiantesPeriodo"]) {
    for(const field of ["cedula","numeroIdentificacion","Cedula"]) {
      for(const group of groups) {
        const data=await enrollmentQuery(token,collection,field,group);
        for(const x of data)if(x.document) {
          const doc=unpack(x.document,collection);
          seen.set(collection+"/"+doc.id,doc);
        }
      }
    }
  }
  return [...seen.values()];
}
function db() {
  const url=new URL(DB_URL);
  if(!url.hostname.endsWith(".neon.tech"))throw Error("NEON_DATABASE_URL debe pertenecer a Neon.");
  const endpoint="https://"+url.hostname.replace(/^[^.]+\./,"api.")+"/sql";
  return async(sql,...params)=>{
    const x=await json(endpoint,{method:"POST",headers:{"content-type":"application/json",
      "Neon-Connection-String":DB_URL,"Neon-Raw-Text-Output":"true","Neon-Array-Mode":"true"},
      body:JSON.stringify({query:sql,params:params.map(p=>p===null?null:String(p))})});
    return x.rows;
  };
}
async function persist(q,periodos,matriculas,respondentes) {
  for(let i=0;i<periodos.length;i+=200) {
    const data=periodos.slice(i,i+200);
    await q(`insert into doctorado_periodos(periodo_id,nombre,inicio,fin)
      select x.periodo_id,x.nombre,x.inicio,x.fin from jsonb_to_recordset($1::jsonb)
      as x(periodo_id text,nombre text,inicio text,fin text)
      on conflict(periodo_id) do update set nombre=excluded.nombre,inicio=excluded.inicio,
        fin=excluded.fin,actualizado=now()`,JSON.stringify(data));
  }
  for(let i=0;i<matriculas.length;i+=200) {
    const data=matriculas.slice(i,i+200);
    await q(`insert into doctorado_matriculas(cedula,periodo_id,carrera,modalidad,sede,fuente)
      select x.cedula,x.periodo_id,x.carrera,x.modalidad,x.sede,'firebase_utet'
      from jsonb_to_recordset($1::jsonb)
      as x(cedula text,periodo_id text,carrera text,modalidad text,sede text)
      on conflict(cedula,periodo_id) do update set
      carrera=case when excluded.carrera<>'' then excluded.carrera else doctorado_matriculas.carrera end,
      modalidad=case when excluded.modalidad<>'' then excluded.modalidad else doctorado_matriculas.modalidad end,
      sede=case when excluded.sede<>'' then excluded.sede else doctorado_matriculas.sede end,
      actualizado=now()`,JSON.stringify(data));
  }
  // Una respuesta histórica solo se asocia automáticamente si existe
  // UNA única matrícula académica para esa cédula. No confunde cohortes.
  await q(`insert into doctorado_asignaciones(cedula,etapa,periodo_id,fuente)
    select r.cedula,r.etapa,u.periodo_id,'automatica_unica'
    from (
      select cedula,etapa,periodo_id from doctorado_respuestas
      union all select cedula,'regulares' as etapa,periodo_id from doctorado_regulares
    ) r
    join (select cedula,min(periodo_id) as periodo_id
      from doctorado_matriculas group by cedula having count(*)=1) u on u.cedula=r.cedula
    where r.periodo_id='' on conflict (cedula,etapa) do nothing`);
  await q(`update doctorado_sync_estado
    set ejecutado_en=now(),estado='correcto',detalle='Sincronización automática',
      estudiantes=$1::integer,matriculas=$2::integer,periodos=$3::integer
    where origen='firebase_utet'`,respondentes,matriculas.length,periodos.length);
}
async function main() {
  if(!SA||!DB_URL) {
    console.log("CONFIGURACION_PENDIENTE: definir FIREBASE_UTET_SERVICE_ACCOUNT_JSON y NEON_DATABASE_URL en GitHub Secrets.");
    return;
  }
  const q=db();
  const raw=await q("select cedula from doctorado_respuestas union select cedula from doctorado_regulares");
  const cedulas=[...new Set(raw.map(x=>x[0]).filter(x=>/^[0-9]{10}$/.test(x)))];
  if(!cedulas.length){ console.log("Sin respuestas para clasificar.");return; }
  const access=await auth();
  const [catalog,docs]=await Promise.all([listPeriods(access),matriculasFirestore(access,cedulas)]);
  const normalized=convertirMatriculas(docs,cedulas,catalog);
  if(!normalized.periodos.length || !normalized.matriculas.length)
    throw Error("No se encontraron matrículas UTET verificables para los participantes. No se guardaron asociaciones.");
  await persist(q,normalized.periodos,normalized.matriculas,cedulas.length);
  console.log("Sincronización completada:",{participantes:cedulas.length,
    periodos:normalized.periodos.length,matriculas:normalized.matriculas.length});
}
main().catch(e=>{console.error("Fallo de sincronización:",e.message);process.exitCode=1;});
