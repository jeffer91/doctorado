// src/admin.js — Panel privado. La autorización se aplica en Firestore Rules,
// no depende de que la ruta del panel sea desconocida.
import { STAGES, QUESTIONS } from "./questions.js";
import { ready, onLoginChange, signInAdmin, signOutUser, isGoogleUser, fetchSurveys, readableError } from "./firebase.js";

const escapeHTML=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const labelFor=(q,value)=>{
  if(Array.isArray(value))return value.map(v=>q.options?.find(o=>o[0]===v)?.[1]||v).join(" | ");
  if(value&&typeof value==="object")return Object.entries(value).map(([k,v])=>(q.rows?.find(r=>r[0]===k)?.[1]||k)+": "+(q.options?.find(x=>x[0]===v)?.[1]||v)).join(" | ");
  return q.options?.find(o=>o[0]===value)?.[1]||String(value??"");
};
const questionMap=(stage,id)=>QUESTIONS[stage]?.find(q=>q.id===id);
const avg=(arr)=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
const formatDate=d=>d instanceof Date&&!Number.isNaN(d.valueOf())?d.toLocaleString("es-EC",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}):"Sin fecha";
const initialShell=html=>'<header class="site-header"><nav class="nav"><a href="#/" class="brand"><span class="brand-mark">D</span><span>Doctorado · ITSQMET<small>Investigación formativa</small></span></a><div class="nav-actions"><a href="#/" class="nav-link">Encuestas</a><a href="#/admin" class="nav-link">Administración</a></div></nav></header><main class="main"><div class="admin-layout">'+html+'</div></main>';
function error(root,msg){root.innerHTML=initialShell('<a href="#/" class="page-back">← Volver</a><div class="surface"><section class="panel"><h2>No se pudo acceder</h2><div class="alert">'+escapeHTML(msg)+'</div><a href="#/admin" id="retry-admin" class="btn ghost">Reintentar</a></section></div>');root.querySelector("#retry-admin")?.addEventListener("click",()=>renderAdmin(root));}
async function signedUser(){
  return new Promise(resolve=>{
    let off=()=>{};
    off=onLoginChange(user=>{off();resolve(user);});
  });
}
function download(name,contents,mime){
  const blob=new Blob([contents],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1200);
}
function csvValue(value){
  let s=String(value??"");
  if(/^[\s]*[=+\-@]/.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
}
function exportCSV(rows){
  const cols=["codigo","cedula","carrera","etapa","fecha",...Array.from({length:10},(_,i)=>"p"+(i+1)),"capacidad_problema","capacidad_fuentes","capacidad_metodos","capacidad_datos","capacidad_redaccion"];
  const data=rows.map(x=>{
    const matrix=x.answers?.[x.etapa==="finalizados"?"q3":"q4"]||{};
    return [x.id,x.cedula,x.carrera,x.etapa,x.fecha?.toISOString?.()||"",...Array.from({length:10},(_,i)=>{
      const q=questionMap(x.etapa,"q"+(i+1));
      return q?labelFor(q,x.answers?.["q"+(i+1)]):"";
    }),...["problema","fuentes","metodos","datos","redaccion"].map(k=>matrix?.[k]||"")];
  });
  const csv="\ufeff"+[cols,...data].map(row=>row.map(csvValue).join(",")).join("\r\n");
  download("doctorado_respuestas_"+new Date().toISOString().slice(0,10)+".csv",csv,"text/csv;charset=utf-8");
}
function bars(items, limit=9) {
  const top=items.slice(0,limit);
  if(!top.length)return '<p class="muted">No hay respuestas para este filtro.</p>';
  const numerical=x=>Number.parseFloat(String(x).replace("%","").trim())||0;
  const max=Math.max(1,...top.map(x=>numerical(x[1])));
  return top.map(([name,count])=>'<div class="bar-item"><div class="bar-label"><span>'+escapeHTML(name)+'</span><strong>'+escapeHTML(count)+'</strong></div><div class="bar-track"><i style="width:'+Math.round(100*numerical(count)/max)+'%"></i></div></div>').join("");
}
function rankCounts(map){
  return [...map.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],"es"));
}
function graphPanel(title,content){return '<section class="chart-panel"><h3>'+escapeHTML(title)+'</h3>'+content+'</section>';}
function draw(root,all){
  let etapa="all",carrera="all",buscar="";
  const markup='<a class="page-back" href="#/">← Ir a las encuestas</a><div class="admin-header"><div><span class="eyebrow">Panel privado de investigación</span><h1 class="page-title">Resultados de las encuestas</h1><p class="page-subtitle">Información confidencial. No publiques exportaciones identificables.</p></div><div class="admin-actions"><button id="refresh" class="btn ghost">Actualizar</button><button id="export" class="btn primary">Exportar CSV</button><button id="logout" class="btn outline">Cerrar sesión</button></div></div><div id="dashboard-body"></div>';
  root.innerHTML=initialShell(markup);
  root.querySelector("#refresh").addEventListener("click",()=>renderAdmin(root));
  root.querySelector("#logout").addEventListener("click",async()=>{await signOutUser();renderAdmin(root);});
  root.querySelector("#export").addEventListener("click",()=>exportCSV(filtered()));
  const filtered=()=>all.filter(r=>(etapa==="all"||r.etapa===etapa)&&(carrera==="all"||r.carrera===carrera)&&(!buscar||[r.cedula,r.carrera,r.id].some(x=>String(x||"").toLowerCase().includes(buscar.toLowerCase()))));
  const careerOptions=[...new Set(all.map(x=>x.carrera).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"es"));
  function refresh(){
    const rows=filtered();
    const counts={inicio:0,desarrollo:0,finalizados:0};
    for(const r of rows)if(Object.hasOwn(counts,r.etapa))counts[r.etapa]++;
    const n=rows.length,people=new Set(rows.map(r=>r.cedula)).size;
    const stats='<div class="stats"><div class="stat"><small>Encuestas recibidas</small><b>'+n+'</b></div><div class="stat"><small>Participantes distintos</small><b>'+people+'</b></div><div class="stat"><small>En inicio</small><b class="accent">'+counts.inicio+'</b></div><div class="stat"><small>En desarrollo / finalizados</small><b>'+counts.desarrollo+' / '+counts.finalizados+'</b></div></div>';
    const countByStage=Object.entries(STAGES).map(([k,s])=>[s.label,counts[k]]);
    const support=new Map();
    rows.forEach(r=>(r.answers?.q9||[]).forEach(v=>{
      const label=questionMap(r.etapa,"q9")?.options?.find(x=>x[0]===v)?.[1]||v;
      support.set(label,(support.get(label)||0)+1);
    }));
    const skillKeys=["problema","fuentes","metodos","datos","redaccion"];
    const skillNames=["Pregunta de investigación","Fuentes científicas","Métodos y técnicas","Análisis de datos","Redacción académica"];
    const skillStats=skillKeys.map((key,i)=>{
      const votes=rows.map(r=>Number(r.answers?.[r.etapa==="finalizados"?"q3":"q4"]?.[key])).filter(v=>v>=1&&v<=5);
      return [skillNames[i],votes.length?Math.round(100*votes.filter(v=>v>=4).length/votes.length):0];
    });
    const charts='<div class="admin-sections">'+graphPanel("Participación por etapa",bars(countByStage))+graphPanel("Apoyos solicitados · pregunta 9",bars(rankCounts(support),7))+graphPanel("Autopercepción alta (4–5) por competencia",bars(skillStats.map(([n,v])=>[n,v+" %"])))+graphPanel("Interpretación de resultados",'<p class="muted" style="line-height:1.8">La encuesta describe experiencias y competencias <strong>autopercibidas</strong>. Las diferencias entre etapas no prueban mejora individual ni efecto causal. Contrasta estos datos con la evaluación externa de los artículos y con los resultados del proceso institucional.</p><p class="muted">Los porcentajes de competencias son la proporción de respuestas 4–5 entre quienes contestaron cada ítem.</p>')+'</div>';
    const table=rows.slice().sort((a,b)=>(b.fecha?.valueOf?.()||0)-(a.fecha?.valueOf?.()||0)).map(r=>{
      const stage=STAGES[r.etapa]?.label||r.etapa;
      const detail=QUESTIONS[r.etapa]?.map(q=>'<div style="margin:11px 0"><strong>'+escapeHTML(q.question)+'</strong><div class="muted">'+escapeHTML(labelFor(q,r.answers?.[q.id]))+'</div></div>').join("")||"";
      return '<tr><td>'+escapeHTML(formatDate(r.fecha))+'</td><td><span class="pill '+escapeHTML(r.etapa)+'">'+escapeHTML(stage)+'</span></td><td>'+escapeHTML(r.carrera)+'</td><td class="mono">••••••'+escapeHTML(String(r.cedula||"").slice(-4))+'</td><td><details><summary style="cursor:pointer;color:#168177">Ver respuestas</summary><div style="max-width:420px;padding:12px 0">'+detail+'</div></details></td></tr>';
    }).join("");
    root.querySelector("#dashboard-body").innerHTML=stats+'<div class="filters"><label><span class="label">Etapa</span><select id="filter-stage" class="field"><option value="all">Todas</option>'+Object.entries(STAGES).map(([k,v])=>'<option value="'+k+'" '+(etapa===k?"selected":"")+'>'+escapeHTML(v.label)+'</option>').join("")+'</select></label><label><span class="label">Carrera</span><select id="filter-career" class="field"><option value="all">Todas</option>'+careerOptions.map(c=>'<option value="'+escapeHTML(c)+'" '+(carrera===c?"selected":"")+'>'+escapeHTML(c)+'</option>').join("")+'</select></label><label><span class="label">Buscar registro</span><input id="filter-search" class="field" placeholder="Cédula o carrera" value="'+escapeHTML(buscar)+'"></label><button id="clear-filters" class="btn ghost">Limpiar</button></div>'+charts+'<section class="panel"><h2>Registro de respuestas</h2><p>'+n+' encuestas según los filtros actuales. La cédula está oculta en pantalla; se incluye en el CSV para cruces autorizados.</p><div class="data-table-wrap">'+(table?'<table class="data-table"><thead><tr><th>Recibida</th><th>Etapa</th><th>Carrera</th><th>Identificador</th><th>Detalle</th></tr></thead><tbody>'+table+'</tbody></table>':'<div class="empty-state">Todavía no hay registros para estos filtros.</div>')+'</div></section>';
    root.querySelector("#filter-stage").addEventListener("change",e=>{etapa=e.target.value;refresh();});
    root.querySelector("#filter-career").addEventListener("change",e=>{carrera=e.target.value;refresh();});
    root.querySelector("#filter-search").addEventListener("input",e=>{buscar=e.target.value;refresh();document.querySelector("#filter-search")?.focus();document.querySelector("#filter-search")?.setSelectionRange(buscar.length,buscar.length);});
    root.querySelector("#clear-filters").addEventListener("click",()=>{etapa="all";carrera="all";buscar="";refresh();});
  }
  refresh();
}
export async function renderAdmin(root){
  if(!ready()){error(root,"La aplicación todavía necesita su configuración de Firebase en el despliegue. Consulta las instrucciones del repositorio.");return;}
  root.innerHTML=initialShell('<div class="loading-screen" style="min-height:320px"><span class="spinner"></span> Validando acceso...</div>');
  let user;
  try{user=await signedUser();}catch(e){error(root,readableError(e));return;}
  if(location.hash!=="#/admin")return;
  if(!isGoogleUser(user)){
    root.innerHTML=initialShell('<div class="admin-login"><a href="#/" class="page-back">← Volver</a><section class="panel"><div class="circle">♜</div><span class="eyebrow">Acceso restringido</span><h2>Administración doctoral</h2><p>Inicia sesión con tu cuenta de Google autorizada. Los permisos de lectura se comprueban en Firebase, no en el navegador.</p><button id="login-google" class="btn primary full">Ingresar con Google</button><div id="login-message" aria-live="polite"></div></section></div>');
    root.querySelector("#login-google").addEventListener("click",async e=>{
      const btn=e.currentTarget;btn.disabled=true;btn.textContent="Abriendo Google...";
      try{await signInAdmin();renderAdmin(root);}catch(e){btn.disabled=false;btn.textContent="Ingresar con Google";root.querySelector("#login-message").innerHTML='<div class="alert">'+escapeHTML(readableError(e))+'</div>';}
    });return;
  }
  root.innerHTML=initialShell('<div class="loading-screen" style="min-height:320px"><span class="spinner"></span> Consultando respuestas protegidas...</div>');
  try {
    const rows=await fetchSurveys();
    if(location.hash==="#/admin")draw(root,rows);
  }catch(e){if(location.hash==="#/admin")error(root,readableError(e)+" Si tu cuenta no está autorizada, solicita al administrador habilitarla en las reglas.");}
}
