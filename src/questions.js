// src/questions.js — Instrumentos diagnósticos para tesis doctoral ITSQMET.
// Version 1.0: propuesta sometida a pilotaje/validación, no escala validada.
// q1, q4 y q9 se mantienen comparables entre las tres etapas.
export const STAGES = {
  inicio: { label: "Estoy iniciando", title: "Antes de empezar a investigar", subtitle: "Tu preparación y lo que necesitas para comenzar.", icon: "seedling", minutes: "5 min" },
  desarrollo: { label: "Estoy desarrollando", title: "Mientras elaboras tu artículo", subtitle: "Las clases, los avances y los desafíos reales.", icon: "pen", minutes: "5 min" },
  finalizados: { label: "Ya finalicé", title: "Después de terminar tu artículo", subtitle: "Lo aprendido y los aspectos que pueden mejorar.", icon: "check", minutes: "5 min" }
};
export const LEVELS = [
  ["1","Nada capaz"],["2","Poco capaz"],["3","Moderadamente capaz"],["4","Bastante capaz"],["5","Muy capaz"]
];
const experiences = [
  ["problemas","Investigar problemas relacionados con mi carrera"],
  ["fuentes","Buscar y analizar artículos científicos"],
  ["recoleccion","Recopilar información mediante encuestas, entrevistas u otras técnicas"],
  ["analisis","Analizar datos y elaborar conclusiones"],
  ["informes","Redactar informes de investigación"],
  ["ninguna","Ninguna de las anteriores"]
];
const abilities = [
  ["problema","Delimitar un tema y formular una pregunta de investigación"],
  ["fuentes","Buscar información científica confiable"],
  ["metodos","Seleccionar métodos y técnicas de investigación"],
  ["datos","Analizar datos y explicar resultados"],
  ["redaccion","Redactar un artículo académico"]
];
const support = [
  ["proyectos","Realizar investigaciones prácticas durante la carrera"],
  ["fuentes","Recibir orientación para buscar fuentes científicas"],
  ["talleres","Participar en talleres de metodología"],
  ["datos","Aprender a recopilar y analizar datos"],
  ["redaccion","Practicar la redacción científica"],
  ["carrera","Recibir orientación específica de mi carrera"],
  ["retro","Recibir revisiones con observaciones claras"]
];
const difficulties = [
  ["problema","Planteamiento del problema y objetivos"],
  ["fuentes","Búsqueda y análisis de información científica"],
  ["metodologia","Elaboración de la metodología"],
  ["datos","Recopilación y análisis de datos"],
  ["resultados","Presentación y discusión de resultados"],
  ["redaccion","Redacción de conclusiones, citas y referencias"],
  ["ninguna","No he tenido dificultades importantes"]
];
const q1 = {id:"q1",type:"multi",question:"Durante tu carrera, antes de comenzar el artículo académico, ¿qué actividades de investigación realizaste?",hint:"Puedes marcar varias opciones.",options:experiences,exclusive:["ninguna"]};
const q4 = {id:"q4",type:"matrix",question:"Actualmente, ¿qué tan capaz te consideras de realizar estas actividades?",hint:"Responde cada fila según tu capacidad actual. No es una evaluación de notas.",rows:abilities,options:LEVELS};
const q9 = {id:"q9",type:"multi",max:2,question:"¿Qué tipo de apoyo consideras más importante para elaborar un artículo académico de calidad?",hint:"Selecciona hasta dos.",options:support};
const open = (question)=>({id:"q10",type:"text",optional:true,question,hint:"Opcional. Puedes dejar esta respuesta en blanco.",maxLength:600});
const scale = (id,question,special=[])=>({id,type:"single",question,options:[["1","Nada"],["2","Poco"],["3","Moderadamente"],["4","Bastante"],["5","Mucho"],...special]});
const readiness = (id,question,special=[])=>({id,type:"single",question,options:[["1","Nada preparado"],["2","Poco preparado"],["3","Moderadamente preparado"],["4","Bastante preparado"],["5","Muy preparado"],...special]});
export const QUESTIONS = {
  inicio: [
    q1,
    {id:"q2",type:"single",question:"Durante tu carrera, ¿con qué frecuencia realizaste trabajos de investigación con orientación docente?",options:[["1","Nunca"],["2","Rara vez"],["3","Algunas veces"],["4","Frecuentemente"],["5","Muy frecuentemente"]]},
    readiness("q3","Al comenzar el artículo académico, ¿qué tan preparado te sientes para investigar?"),
    q4,
    {id:"q5",type:"single",question:"¿En qué situación se encuentra tu tema de investigación?",options:[["buscando","Todavía estoy buscando un tema"],["idea","Tengo una idea, pero necesito delimitarla"],["revision","Ya presenté el tema para revisión"],["aprobado","Mi tema ya fue aprobado"]]},
    {id:"q6",type:"single",question:"¿Cuál ha sido tu principal dificultad para elegir o definir el tema?",options:[["problema","Encontrar un problema relacionado con mi carrera"],["delimitar","Delimitar el tema"],["fuentes","Encontrar información científica"],["pregunta","Formular la pregunta y los objetivos"],["ninguna","No he tenido dificultades"],["sin_empezar","Todavía no he comenzado a elegirlo"]]},
    {id:"q7",type:"single",question:"¿Qué tan claras te resultaron las explicaciones de la inducción sobre el proceso?",options:[["1","Nada claras"],["2","Poco claras"],["3","Moderadamente claras"],["4","Bastante claras"],["5","Muy claras"],["no_aplica","Todavía no he participado"]]},
    {id:"q8",type:"multi",max:2,question:"¿Qué partes del artículo crees que podrían resultarte más difíciles?",hint:"Selecciona hasta dos. Responde según lo que esperas, no lo que ya viviste.",options:[["problema","Plantear el problema y los objetivos"],["fuentes","Buscar y analizar información científica"],["metodologia","Desarrollar la metodología"],["datos","Recopilar y analizar datos"],["redaccion","Redactar resultados, discusión y conclusiones"],["defensa","Preparar la defensa oral"],["no_se","Todavía no lo sé"]],exclusive:["no_se"]},
    q9,
    open("¿Qué te gustaría aprender o reforzar para elaborar mejor tu artículo académico?")
  ],
  desarrollo: [
    q1,
    {id:"q2",type:"single",question:"¿En cuántas de las tres clases de metodología has participado?",options:[["0","En ninguna"],["1","En una clase"],["2","En dos clases"],["3","En las tres clases"]]},
    scale("q3","¿Qué tanto te han ayudado las clases de metodología para desarrollar tu artículo?",[["no_aplica","Todavía no he participado"]]),
    q4,
    {id:"q5",type:"single",question:"¿Cuánto te ha ayudado el refuerzo por carrera a relacionar la investigación con tu profesión?",options:[["1","Nada"],["2","Poco"],["3","Moderadamente"],["4","Bastante"],["5","Mucho"],["no_aplica","Todavía no he participado"]]},
    {id:"q6",type:"multi",max:2,question:"¿En qué partes del artículo has encontrado mayores dificultades?",hint:"Selecciona hasta dos.",options:difficulties,exclusive:["ninguna"]},
    {id:"q7",type:"single",question:"¿Qué tan claras han sido las observaciones recibidas para mejorar tu artículo?",options:[["1","Nada claras"],["2","Poco claras"],["3","Moderadamente claras"],["4","Bastante claras"],["5","Muy claras"],["no_aplica","Todavía no he recibido revisiones"]]},
    {id:"q8",type:"multi",max:2,question:"¿Qué factores han dificultado más tu avance?",hint:"Selecciona hasta dos.",options:[["conocimientos","Conocimientos insuficientes sobre investigación"],["fuentes","Dificultad para conseguir fuentes científicas"],["datos","Dificultad para recopilar o analizar datos"],["tiempo","Poco tiempo disponible"],["redaccion","Dificultades para redactar"],["orientacion","Necesidad de mayor orientación"],["correcciones","Dificultad para aplicar las correcciones"],["ninguno","Ninguno"]],exclusive:["ninguno"]},
    q9,
    open("¿Qué mejorarías de las clases, orientaciones o revisiones para facilitar tu artículo?")
  ],
  finalizados: [
    q1,
    readiness("q2","Cuando comenzaste el artículo, ¿qué tan preparado te sentías para investigar?",[["no_recuerdo","No recuerdo"]]),
    { ...q4, id:"q3" },
    {id:"q4",type:"multi",max:2,question:"¿En qué partes del artículo encontraste mayores dificultades?",hint:"Selecciona hasta dos.",options:difficulties,exclusive:["ninguna"]},
    {id:"q5",type:"single",question:"¿Qué actividad te ayudó más a completar tu artículo?",options:[["metodologia","Las clases de metodología"],["refuerzo","El refuerzo por carrera"],["revisiones","Las observaciones en las revisiones"],["previa","Las investigaciones realizadas durante mi carrera"],["autonomo","El trabajo independiente"],["companeros","La colaboración de compañeros"],["ninguna","Ninguna de las anteriores"]]},
    {id:"q6",type:"single",question:"¿Qué tan suficientes fueron las clases de metodología para desarrollar tu artículo?",options:[["1","Nada suficientes"],["2","Poco suficientes"],["3","Moderadamente suficientes"],["4","Bastante suficientes"],["5","Totalmente suficientes"],["no_aplica","No participé en esas clases"]]},
    {id:"q7",type:"single",question:"¿Qué tan útiles fueron las observaciones de las revisiones para mejorar el artículo final?",options:[["1","Nada útiles"],["2","Poco útiles"],["3","Moderadamente útiles"],["4","Bastante útiles"],["5","Muy útiles"],["no_aplica","No recibí observaciones"]]},
    readiness("q8","¿Qué tan preparado te sentiste para explicar y defender tu investigación?"),
    q9,
    open("Si volvieras a elaborar el artículo, ¿qué cambiarías de la formación o del acompañamiento recibido?")
  ]
};
export function validateInstrument() {
  for (const stage of Object.keys(STAGES)) {
    const items = QUESTIONS[stage];
    if (!items || items.length !== 10 || new Set(items.map(q=>q.id)).size !== 10) return false;
    if (items.some(q=>!q.question || !["single","multi","matrix","text"].includes(q.type))) return false;
  }
  return true;
}
