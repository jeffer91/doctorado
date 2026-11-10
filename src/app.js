// src/app.js — Rutas públicas, consentimiento y encuestas responsivas.
import { STAGES, QUESTIONS, validateInstrument } from "./questions.js";
import { CAREERS } from "./catalog.js";
import { ready, submitSurvey, readableError } from "./firebase.js";
import { renderAdmin } from "./admin.js";

const root = document.getElementById("app");
let survey = null;
const symbol = {inicio:"✦", desarrollo:"✎", finalizados:"✓"};
function esc(s) { return String(s ?? "").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function route() { return (location.hash.slice(2).split("?")[0] || "").toLowerCase(); }
function shell(content) {
  root.innerHTML = '<header class="site-header"><nav class="nav"><a href="#/" class="brand"><span class="brand-mark">D</span><span>Doctorado · ITSQMET<small>Investigación formativa</small></span></a><div class="nav-actions"><a class="nav-link" href="#/">Encuestas</a><a class="nav-link" href="#/admin">Administración</a></div></nav></header><main class="main">'+content+'</main>';
}
function home() {
  survey=null;
  const cards=Object.entries(STAGES).map(([key,st])=>'<a class="stage-card" href="#/'+key+'"><span class="circle" aria-hidden="true">'+symbol[key]+'</span><h3>'+esc(st.label)+'</h3><p>'+esc(st.subtitle)+' Responde 10 preguntas adaptadas a tu etapa.</p><span class="card-footer"><span>Comenzar encuesta →</span><span class="tag">'+st.minutes+'</span></span></a>').join("");
  shell('<section class="hero"><div><span class="eyebrow">Investigación doctoral · ITSQMET</span><h1>Tu experiencia puede mejorar la forma de aprender a investigar.</h1><p>Queremos comprender cómo los estudiantes preparan, desarrollan y finalizan sus artículos académicos. Tu opinión ayudará a identificar necesidades de formación.</p></div><div class="hero-graphic" aria-hidden="true"><div class="orbit"><span class="orbit-inner">D.</span></div></div></section><section><div class="section-head"><div><span class="eyebrow">Selecciona tu etapa</span><h2>¿En qué parte del proceso estás?</h2><p>Elige solamente la encuesta que corresponde a tu avance actual, sin importar las fechas.</p></div></div><div class="stage-grid">'+cards+'</div><div class="info-strip"><span class="info-icon">ⓘ</span><span>La participación es voluntaria y no influye en tus calificaciones. La cédula permite relacionar tu respuesta con registros académicos autorizados; los resultados de investigación se analizarán mediante códigos y de forma agrupada.</span></div></section><div class="footer">Investigación doctoral · Instituto Superior Tecnológico Quito Metropolitano</div>');
}
function start(stage) {
  if (!survey || survey.stage !== stage) survey={stage,cedula:"",carrera:"",consent:false,answers:{},index:0,done:false};
  const cfg=ready()?"":'<div class="alert">El formulario todavía no está habilitado para recibir datos. La persona administradora debe completar la configuración segura de Firebase antes de difundir este enlace.</div>';
  const careers=CAREERS.map(x=>'<option value="'+esc(x)+'" '+(survey.carrera===x?"selected":"")+'>'+esc(x)+'</option>').join("");
  shell('<div class="surface"><a class="page-back" href="#/">← Volver a las encuestas</a><span class="eyebrow">Encuesta · '+esc(STAGES[stage].label)+'</span><h1 class="page-title">'+esc(STAGES[stage].title)+'</h1><p class="page-subtitle">'+esc(STAGES[stage].subtitle)+' Son 10 preguntas y puedes dejar la última sin responder.</p><div class="panel"><h2>Antes de comenzar</h2><p>Usaremos tus datos de registro únicamente para organizar la investigación doctoral, evitar respuestas duplicadas y, cuando exista autorización, comparar resultados académicos. No consultamos tu expediente personal desde este formulario.</p>'+cfg+'<form id="identity-form"><label class="label" for="cedula">Cédula de identidad (10 dígitos)</label><input id="cedula" name="cedula" class="field" type="text" inputmode="numeric" pattern="[0-9]{10}" maxlength="10" autocomplete="off" required placeholder="Ingresa los 10 dígitos" value="'+esc(survey.cedula)+'"><p class="input-note">La cédula identifica un registro, pero por sí sola no verifica que quien responde sea su titular.</p><label class="label" for="carrera">Carrera que cursas o cursaste</label><select id="carrera" name="carrera" class="field" required><option value="">Selecciona tu carrera</option>'+careers+'</select><label class="check-row"><input type="checkbox" name="consent" required '+(survey.consent?"checked":"")+'><span>He leído el propósito de esta encuesta. <strong>Acepto voluntariamente</strong> participar y que mis respuestas y mi identificación se traten de manera restringida para esta investigación. Comprendo que puedo decidir no participar sin consecuencias académicas.</span></label><button class="btn primary full" type="submit" '+(!ready()?"disabled":"")+'>Comenzar las 10 preguntas →</button><div id="form-error" aria-live="polite"></div></form></div></div>');
  document.querySelector("#identity-form")?.addEventListener("submit",e=>{
    e.preventDefault();
    const f=e.currentTarget;
    const cedula=f.cedula.value.trim();
    if(!/^\d{10}$/.test(cedula)){document.querySelector("#form-error").innerHTML='<div class="alert">Ingresa los 10 dígitos de tu cédula.</div>';return;}
    survey.cedula=cedula;survey.carrera=f.carrera.value;survey.consent=f.consent.checked;survey.index=0;survey.done=false;
    question(stage);
  });
}
function answerMarkup(q,answer) {
  if(q.type==="text")return '<textarea class="field text-answer" id="text-answer" maxlength="'+(q.maxLength||600)+'" placeholder="Escribe tu respuesta aquí...">'+esc(answer || "")+'</textarea><p class="input-note">Máximo '+(q.maxLength||600)+' caracteres. Puedes omitir esta pregunta.</p>';
  if(q.type==="matrix") {
    const legend='<div class="matrix-legend">'+q.options.map(([v,l])=>'<span><strong>'+esc(v)+'</strong> = '+esc(l)+'</span>').join(" · ")+'</div>';
    return legend+q.rows.map(([id,label])=>'<div class="matrix-row"><div class="matrix-title">'+esc(label)+'</div><div class="matrix-options">'+q.options.map(([value,text])=>'<label class="matrix-choice" title="'+esc(text)+'"><input type="radio" name="matrix-'+esc(id)+'" data-row="'+esc(id)+'" value="'+esc(value)+'" '+(answer?.[id]===value?"checked":"")+'><span>'+esc(value)+'</span></label>').join("")+'</div></div>').join("");
  }
  return '<div class="option-list">'+q.options.map(([value,label])=>{
    const checked=q.type==="multi"?(Array.isArray(answer)&&answer.includes(value)):answer===value;
    return '<label class="option"><input type="'+(q.type==="multi"?"checkbox":"radio")+'" name="option" value="'+esc(value)+'" '+(checked?"checked":"")+'><span>'+esc(label)+'</span></label>';
  }).join("")+'</div>';
}
function valid(q,a) {
  if(q.optional) return true;
  if(q.type==="multi") return Array.isArray(a)&&a.length>0&&(!q.max||a.length<=q.max);
  if(q.type==="matrix") return q.rows.every(([id])=>Boolean(a?.[id]));
  return typeof a==="string"&&a.length>0;
}
function question(stage) {
  const q=QUESTIONS[stage][survey.index],a=survey.answers[q.id];
  const last=survey.index===9;
  shell('<div class="surface"><a class="page-back" href="#/">← Salir de la encuesta</a><div class="progress-top"><span>'+esc(STAGES[stage].label)+'</span><span>Pregunta '+(survey.index+1)+' de 10</span></div><div class="progress-track" role="progressbar" aria-label="Avance" aria-valuenow="'+(survey.index+1)+'" aria-valuemin="1" aria-valuemax="10"><span style="width:'+((survey.index+1)*10)+'%"></span></div><section class="panel" aria-labelledby="q-title"><span class="eyebrow">'+(q.optional?"Pregunta opcional":"Tu experiencia importa")+'</span><h1 id="q-title" class="question-title">'+esc(q.question)+'</h1><p class="question-help">'+esc(q.hint||(q.type==="multi"?"Selecciona las opciones que correspondan.":"Selecciona una respuesta."))+'</p>'+answerMarkup(q,a)+'<div id="question-error" role="alert" aria-live="polite"></div><div class="actions"><button class="btn ghost" id="prev" type="button">'+(survey.index===0?"Volver al registro":"← Anterior")+'</button><button class="btn primary" id="next" type="button">'+(last?"Enviar encuesta ✓":"Continuar →")+'</button></div></section><p class="input-note" style="text-align:center;margin-top:18px">Responde con sinceridad. No hay respuestas correctas ni incorrectas.</p></div>');
  const showErr=t=>document.querySelector("#question-error").innerHTML='<div class="alert">'+esc(t)+'</div>';
  if(q.type==="text")document.querySelector("#text-answer").addEventListener("input",e=>survey.answers[q.id]=e.target.value);
  else if(q.type==="matrix")document.querySelectorAll("input[data-row]").forEach(el=>el.addEventListener("change",e=>{
    survey.answers[q.id]={...(survey.answers[q.id]||{}),[e.target.dataset.row]:e.target.value};
  }));
  else document.querySelectorAll('input[name="option"]').forEach(el=>el.addEventListener("change",e=>{
    const value=e.target.value;
    if(q.type==="single"){survey.answers[q.id]=value;return;}
    let values=Array.isArray(survey.answers[q.id])?[...survey.answers[q.id]]:[];
    if(e.target.checked) {
      if(q.exclusive?.includes(value))values=[value];
      else {
        values=values.filter(v=>!q.exclusive?.includes(v));
        if(!values.includes(value))values.push(value);
        if(q.max&&values.length>q.max){showErr("Selecciona como máximo "+q.max+" opciones.");e.target.checked=false;return;}
      }
    } else values=values.filter(v=>v!==value);
    survey.answers[q.id]=values;
    document.querySelectorAll('input[name="option"]').forEach(input=>input.checked=values.includes(input.value));
    document.querySelector("#question-error").innerHTML="";
  }));
  document.querySelector("#prev").addEventListener("click",()=>{
    if(survey.index===0) start(stage); else {survey.index--;question(stage);}window.scrollTo({top:0,behavior:"instant"});
  });
  document.querySelector("#next").addEventListener("click",async e=>{
    if(q.optional && typeof survey.answers[q.id]!=="string")survey.answers[q.id]="";
    if(!valid(q,survey.answers[q.id])){showErr(q.type==="matrix"?"Responde las cinco actividades para continuar.":"Selecciona una respuesta antes de continuar.");return;}
    if(!last){survey.index++;question(stage);window.scrollTo({top:0,behavior:"instant"});return;}
    const btn=e.currentTarget;btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Guardando respuesta...';
    try {
      await submitSurvey(survey);
      survey.done=true;
      complete(stage);
    }catch(err){btn.disabled=false;btn.textContent="Reintentar envío";showErr(readableError(err));}
  });
}
function complete(stage) {
  shell('<div class="surface"><section class="panel finished"><span class="finished-symbol">✓</span><span class="eyebrow">Respuesta recibida</span><h2>Gracias por participar.</h2><p>Tu encuesta de la etapa <strong>'+esc(STAGES[stage].label.toLowerCase())+'</strong> se ha guardado. Tu experiencia contribuirá al diagnóstico de la investigación doctoral.</p><a href="#/" class="btn primary">Volver al inicio</a></section></div>');
}
function render() {
  if(!validateInstrument()){shell('<div class="alert">Error de configuración de las preguntas.</div>');return;}
  const r=route();
  if(r==="admin"){renderAdmin(root);return;}
  if(STAGES[r]) {
    if(survey?.stage===r&&survey.done){complete(r);}
    else if(survey?.stage===r&&survey.cedula&&survey.consent){question(r);}
    else start(r);
    return;
  }
  home();
}
window.addEventListener("hashchange",render);
render();
