// src/questions.js — Instrumentos v1 (propuesta en validación, no escala validada).
// se1–se5 son idénticas en las tres etapas: no modificar su texto ni sus opciones.
export const VERSION = 1;

export const STAGES = {
  inicio: { label: "Inicio", title: "Estoy iniciando" },
  proceso: { label: "En proceso", title: "Voy en la mitad" },
  final: { label: "Finalización", title: "Ya terminé" },
  // Grupo de comparación: estudiantes que no tuvieron la modalidad de artículo académico.
  regulares: {
    label: "Examen o tesis", title: "Me gradúo por examen o tesis",
    intro: "El artículo académico es una modalidad de titulación: un trabajo de investigación de 6 a 15 páginas."
  }
};
export const ARTICULO = ["inicio", "proceso", "final"]; // etapas del proceso por artículo académico
// Rutas antiguas que siguen funcionando.
export const ALIASES = { desarrollo: "proceso", finalizados: "final", finalizacion: "final", fin: "final" };

const escala = (a, b, c, d, e) => [[1, a], [2, b], [3, c], [4, d], [5, e]];
export const CAPACIDAD = escala("Nada capaz", "Poco capaz", "Moderadamente capaz", "Bastante capaz", "Totalmente capaz");
const PREPARACION = escala("Nada preparado", "Poco preparado", "Moderadamente preparado", "Bastante preparado", "Totalmente preparado");
const CLAROS = escala("Nada claros", "Poco claros", "Moderadamente claros", "Bastante claros", "Totalmente claros");
const CLARAS = escala("Nada claras", "Poco claras", "Moderadamente claras", "Bastante claras", "Totalmente claras");
export const FRECUENCIA = escala("Nunca", "Rara vez", "Algunas veces", "Frecuentemente", "Siempre");

export const DIFICULTADES = [
  ["tema", "Delimitación del tema"],
  ["bibliografia", "Búsqueda bibliográfica"],
  ["metodologia", "Metodología"],
  ["analisis", "Análisis de resultados"],
  ["redaccion", "Redacción científica"],
  ["tiempo", "Tiempo disponible"],
  ["tecnologia", "Recursos tecnológicos"],
  ["otra", "Otra"]
];

const GUSTO = escala("Definitivamente no", "Probablemente no", "No estoy seguro", "Probablemente sí", "Definitivamente sí");
const NADA_MUCHO = escala("Nada", "Poco", "Algo", "Bastante", "Mucho");
export const ELECCIONES = [["examen", "Examen complexivo"], ["trabajo", "Trabajo de titulación"], ["articulo", "Artículo académico"]];
export const RAZONES_SI = [
  ["corto", "Es un trabajo corto"],
  ["investigar", "Me interesa investigar"],
  ["publicar", "Podría publicarlo"],
  ["carrera", "Aporta más a mi carrera"],
  ["aprender", "Aprendería más que con un examen"],
  ["no_elegiria", "No lo elegiría"],
  ["otra", "Otra"]
];
export const RAZONES_NO = [
  ["preparacion", "No me siento preparado para investigar"],
  ["redaccion", "Me cuesta la redacción científica"],
  ["tiempo", "Falta de tiempo"],
  ["tema", "No sabría qué tema investigar"],
  ["examen", "Prefiero rendir un examen"],
  ["ninguna", "Ninguna, sí lo elegiría"],
  ["otra", "Otra"]
];
export const DIFICULTADES_REG = DIFICULTADES.filter(d => d[0] !== "tecnologia");
export const APOYOS = [
  ["metodologia", "Clases de metodología"],
  ["tutor", "Un tutor que acompañe"],
  ["ejemplos", "Ejemplos de artículos de otros estudiantes"],
  ["tiempo", "Más tiempo"],
  ["talleres", "Talleres de redacción"],
  ["otra", "Otra"]
];

const s = (id, text, options) => ({ id, type: "scale", text, options });
const c = (id, text, options) => ({ id, type: "choice", text, options });
const COMUNES = [
  s("se1", "¿Qué tan capaz se considera de formular un problema de investigación claramente delimitado?", CAPACIDAD),
  s("se2", "¿Qué tan capaz se considera de buscar y seleccionar artículos científicos pertinentes?", CAPACIDAD),
  s("se3", "¿Qué tan capaz se considera de elegir una metodología adecuada para su investigación?", CAPACIDAD),
  s("se4", "¿Qué tan capaz se considera de analizar e interpretar resultados de investigación?", CAPACIDAD),
  s("se5", "¿Qué tan capaz se considera de redactar un artículo académico con estructura científica?", CAPACIDAD)
];
const horas = text => ({ id: "horas", type: "hours", text });
const dificultad = text => c("dificultad", text, DIFICULTADES);

export const QUESTIONS = {
  inicio: [
    ...COMUNES,
    s("p6", "¿Qué tan preparado se considera para comenzar la elaboración del artículo académico?", PREPARACION),
    s("p7", "¿Qué tan claros tiene los requisitos, actividades y criterios de evaluación del proceso?", CLAROS),
    horas("¿Cuántas horas semanales estima que podrá dedicar a la elaboración del artículo?"),
    dificultad("¿Cuál considera que será su principal dificultad?"),
    s("ia", "¿Con qué frecuencia prevé utilizar herramientas de inteligencia artificial durante la elaboración del artículo?", FRECUENCIA)
  ],
  proceso: [
    ...COMUNES,
    s("p6", "¿Con qué frecuencia recibe retroalimentación académica útil para mejorar su artículo?", FRECUENCIA),
    s("p7", "¿Qué tan claras son las observaciones y correcciones que recibe?", CLARAS),
    horas("¿Cuántas horas semanales dedica actualmente a elaborar su artículo?"),
    dificultad("¿Cuál es su principal dificultad actual?"),
    s("ia", "¿Con qué frecuencia utiliza herramientas de inteligencia artificial durante la elaboración del artículo?", FRECUENCIA)
  ],
  final: [
    ...COMUNES,
    s("p6", "¿Con qué frecuencia recibió retroalimentación académica útil para mejorar su artículo?", FRECUENCIA),
    s("p7", "¿Qué tan claras fueron las observaciones y correcciones que recibió?", CLARAS),
    horas("¿Cuántas horas semanales dedicó, en promedio, a elaborar su artículo?"),
    dificultad("¿Cuál fue su principal dificultad durante la elaboración del artículo?"),
    s("ia", "¿Con qué frecuencia utilizó herramientas de inteligencia artificial durante la elaboración del artículo?", FRECUENCIA)
  ],
  regulares: [
    s("gusto", "¿Le hubiera gustado graduarse por la modalidad de artículo académico?", GUSTO),
    c("eleccion", "Si hubiera podido elegir entre las tres modalidades, ¿cuál habría elegido?", ELECCIONES),
    c("razon_si", "¿Cuál sería su razón principal para elegir el artículo académico?", RAZONES_SI),
    c("razon_no", "¿Cuál sería su razón principal para no elegirlo?", RAZONES_NO),
    s("preparacion", "¿Qué tan preparado se sentiría para elaborar un artículo académico de 6 a 15 páginas?", PREPARACION),
    s("formacion", "¿Qué tanto le enseñó su carrera a investigar: buscar fuentes, analizar datos y redactar?", NADA_MUCHO),
    c("dificultad", "¿Qué parte del artículo cree que le resultaría más difícil?", DIFICULTADES_REG),
    c("apoyo", "¿Qué apoyo necesitaría más para elaborar un artículo académico?", APOYOS),
    s("aporte_articulo", "¿Qué tanto cree que elaborar un artículo académico aportaría a su formación profesional?", NADA_MUCHO),
    s("aporte_examen", "¿Qué tanto aportó el examen complexivo a su formación profesional?", NADA_MUCHO)
  ]
};

export const IDS = ["se1", "se2", "se3", "se4", "se5", "p6", "p7", "horas", "dificultad", "ia"];

// Cédula ecuatoriana: 10 dígitos con dígito verificador (módulo 10).
export function cedulaValida(c) {
  if (!/^\d{10}$/.test(c)) return false;
  const prov = +c.slice(0, 2);
  if (!((prov >= 1 && prov <= 24) || prov === 30) || +c[2] > 5) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let v = +c[i] * (i % 2 === 0 ? 2 : 1);
    if (v > 9) v -= 9;
    sum += v;
  }
  return (10 - (sum % 10)) % 10 === +c[9];
}

// Convierte las respuestas del formulario en la fila que se guarda.
// answers[id] = valor | "NR" (prefiero no responder) | "NS" (solo horas: no sabe).
// Las opciones "otra" guardan su texto opcional en answers[id + "_otra"].
export function toRow(stage, cedula, answers) {
  const row = { etapa: stage, cedula, omitidas: [] };
  for (const q of QUESTIONS[stage]) {
    const id = q.id, v = answers[id];
    if (v === undefined || v === "") throw new Error("Falta responder una pregunta.");
    if (q.type === "hours") row.horas_ns = false;
    if (v === "NR") { row.omitidas.push(id); row[id] = null; }
    else if (q.type === "hours") {
      if (v === "NS") { row.horas = null; row.horas_ns = true; }
      else {
        const n = Math.round(Number(String(v).replace(",", ".")) * 10) / 10;
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error("Horas no válidas.");
        row.horas = n;
      }
    } else if (q.type === "choice") row[id] = String(v);
    else row[id] = Number(v);
    if (q.type === "choice" && q.options.some(o => o[0] === "otra")) {
      const otra = String(answers[id + "_otra"] || "").trim().slice(0, 200);
      row[id + "_otra"] = row[id] === "otra" && otra ? otra : null;
    }
  }
  return row;
}
