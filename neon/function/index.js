// Función "encuestas" (Neon Functions): única puerta de entrada a la base principal.
// Público: POST /respuestas. Administrador: /admin/* con sesión por token.
import { randomBytes, createHash } from "node:crypto";

// Cliente mínimo del protocolo SQL-sobre-HTTP de Neon (sin dependencias).
// Todos los parámetros viajan como texto y cada consulta devuelve columnas de texto.
async function neonHttp(query, params) {
  const url = new URL(process.env.DATABASE_URL);
  const res = await fetch("https://" + url.hostname.replace(/^[^.]+\./, "api.") + "/sql", {
    method: "POST",
    headers: { "Neon-Connection-String": process.env.DATABASE_URL, "Neon-Raw-Text-Output": "true", "Neon-Array-Mode": "true" },
    body: JSON.stringify({ query, params })
  });
  if (!res.ok) throw new Error("Neon " + res.status + ": " + (await res.text()).slice(0, 300));
  return (await res.json()).rows;
}
let ejecutar = neonHttp;
export function usarSql(otro) { ejecutar = otro; } // solo para pruebas locales
const txt = v => (v === null || v === undefined ? null : String(v));
const q = (query, ...params) => ejecutar(query, params.map(txt));

const ORIGENES = /^https:\/\/jeffer91\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
// Definición de cada encuesta: tabla, preguntas de escala 1–5 y preguntas de opción única.
const ARTICULO = {
  tabla: "doctorado_respuestas", horas: true,
  escalas: ["se1", "se2", "se3", "se4", "se5", "p6", "p7", "ia"],
  opciones: { dificultad: ["tema", "bibliografia", "metodologia", "analisis", "redaccion", "tiempo", "tecnologia", "otra"] }
};
const ENCUESTAS = {
  inicio: ARTICULO, proceso: ARTICULO, final: ARTICULO,
  regulares: {
    tabla: "doctorado_regulares", horas: false,
    escalas: ["gusto", "preparacion", "formacion", "aporte_articulo", "aporte_examen"],
    opciones: {
      eleccion: ["examen", "trabajo", "articulo"],
      razon_si: ["corto", "investigar", "publicar", "carrera", "aprender", "no_elegiria", "otra"],
      razon_no: ["preparacion", "redaccion", "tiempo", "tema", "examen", "ninguna", "otra"],
      dificultad: ["tema", "bibliografia", "metodologia", "analisis", "redaccion", "tiempo", "otra"],
      apoyo: ["metodologia", "tutor", "ejemplos", "tiempo", "talleres", "otra"]
    }
  }
};
const SESION_HORAS = 12;

const hash = t => createHash("sha256").update(t).digest("hex");

function cors(req) {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENES.test(o) ? o : "https://jeffer91.github.io",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type,authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin"
  };
}
function json(req, status, body) {
  return new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...cors(req) }
  });
}
async function body(req) {
  const text = await req.text();
  if (text.length > 200_000) throw new Error("grande");
  return JSON.parse(text || "{}");
}

// Valida y normaliza una respuesta. Devuelve null si no es válida.
// El resultado es { etapa, cols }, donde cols lleva [columna, valor, tipo SQL].
function limpiar(r) {
  if (!r || typeof r !== "object") return null;
  const e = ENCUESTAS[r.etapa];
  if (!e) return null;
  if (typeof r.cedula !== "string" || !/^\d{10}$/.test(r.cedula)) return null;
  const ids = [...e.escalas, ...Object.keys(e.opciones), ...(e.horas ? ["horas"] : [])];
  const omitidas = Array.isArray(r.omitidas) ? [...new Set(r.omitidas)].filter(x => ids.includes(x)) : [];
  const cols = [["cedula", r.cedula, "text"], ["omitidas", "{" + omitidas.join(",") + "}", "text[]"]];
  if (e === ARTICULO) cols.push(["etapa", r.etapa, "text"]);
  for (const k of e.escalas) {
    const v = r[k] ?? null;
    if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 5)) return null;
    if ((v !== null) === omitidas.includes(k)) return null;
    cols.push([k, v, "smallint"]);
  }
  for (const [k, validas] of Object.entries(e.opciones)) {
    const v = r[k] ?? null;
    if (v !== null && !validas.includes(v)) return null;
    if ((v !== null) === omitidas.includes(k)) return null;
    cols.push([k, v, "text"]);
    if (validas.includes("otra")) {
      const otra = typeof r[k + "_otra"] === "string" ? r[k + "_otra"].trim().slice(0, 200) : "";
      cols.push([k + "_otra", v === "otra" && otra ? otra : null, "text"]);
    }
  }
  if (e.horas) {
    const h = r.horas ?? null, ns = r.horas_ns === true;
    if (h !== null && !(typeof h === "number" && h >= 0 && h <= 100)) return null;
    if ((h !== null) + ns + omitidas.includes("horas") !== 1) return null;
    cols.push(["horas", h === null ? null : Math.round(h * 10) / 10, "numeric(4,1)"], ["horas_ns", ns, "boolean"]);
  }
  return { tabla: e.tabla, cols };
}

// Inserta una fila validada. Devuelve false si esa cédula ya había respondido.
// Los nombres de tabla, columna y tipo salen solo de las constantes de arriba.
async function insertar(f, origen = "web", fecha = null) {
  const cols = [...f.cols, ["origen", origen, "text"]];
  const filas = await q(
    `insert into ${f.tabla} (${cols.map(c => c[0]).join(", ")}, created_at)
     values (${cols.map((c, i) => "$" + (i + 1) + "::" + c[2]).join(", ")}, coalesce($${cols.length + 1}::timestamptz, now()))
     on conflict do nothing
     returning id::text`,
    ...cols.map(c => c[1]), fecha);
  return filas.length === 1;
}

async function sesion(req) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.get("authorization") || "");
  if (!m) return null;
  const filas = await q("select email from doctorado_sesiones where token_hash = $1 and expira > now()", hash(m[1]));
  return filas[0] ? { email: filas[0][0], tokenHash: hash(m[1]) } : null;
}

async function manejar(req) {
  const { pathname } = new URL(req.url);
  const ruta = req.method + " " + pathname.replace(/\/+$/, "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (ruta === "GET " || ruta === "GET /salud") {
    const [r] = await q("select ($1::text[])[2] || ($2::numeric(4,1))::text || ($3::boolean)::text || coalesce(($4::smallint)::text, 'nulo')", "{a,b}", 7.5, true, null);
    return json(req, 200, { ok: r[0] === "b7.5truenulo" });
  }

  if (ruta === "POST /respuestas") {
    const f = limpiar(await body(req));
    if (!f) return json(req, 400, { error: "invalida" });
    return (await insertar(f)) ? json(req, 201, { ok: true }) : json(req, 409, { error: "duplicada" });
  }

  if (ruta === "POST /admin/login") {
    const b = await body(req);
    const email = String(b.email || "").trim().toLowerCase().slice(0, 200);
    const clave = String(b.clave || "").slice(0, 200);
    const [[n]] = await q("select count(*)::text from doctorado_intentos where email = $1 and momento > now() - interval '15 minutes'", email);
    if (Number(n) >= 8) return json(req, 429, { error: "espera" });
    const ok = await q("select '1' from doctorado_admins where email = $1 and clave_hash = crypt($2, clave_hash)", email, clave);
    if (!ok.length) {
      await q("insert into doctorado_intentos (email) values ($1)", email);
      return json(req, 401, { error: "credenciales" });
    }
    const token = randomBytes(32).toString("hex");
    await q("insert into doctorado_sesiones (token_hash, email, expira) values ($1, $2, now() + make_interval(hours => $3::int))", hash(token), email, SESION_HORAS);
    await q("delete from doctorado_sesiones where expira < now()");
    await q("delete from doctorado_intentos where momento < now() - interval '1 day'");
    return json(req, 200, { token });
  }

  if (pathname.startsWith("/admin/")) {
    const s = await sesion(req);
    if (!s) return json(req, 401, { error: "sesion" });

    if (ruta === "GET /admin/respuestas") {
      const leer = async tabla => JSON.parse((await q(
        `select coalesce(json_agg((to_jsonb(t) - 'id') ||
           jsonb_build_object('carrera', coalesce(cl.carrera, ''),
                              'modalidad', coalesce(cl.modalidad, ''),
                              'sede', coalesce(cl.sede, ''),
                              'periodoId', coalesce(cl.periodo_id, ''),
                              'fuenteClasificacion', coalesce(cl.fuente, ''),
                              'fechaClasificacion', cl.sincronizado_en)
           order by t.created_at desc), '[]')::text
         from ${tabla} t left join doctorado_clasificacion cl on cl.cedula = t.cedula`))[0][0]);
      return json(req, 200, { filas: await leer("doctorado_respuestas"), regulares: await leer("doctorado_regulares") });
    }
    if (ruta === "POST /admin/clasificar") {
      const filas = (await body(req)).filas;
      if (!Array.isArray(filas) || filas.length === 0 || filas.length > 500) return json(req, 400, { error: "invalida" });
      const datos = filas.map(x => ({
        cedula: typeof x?.cedula === "string" ? x.cedula.trim() : "",
        carrera: typeof x?.carrera === "string" ? x.carrera.trim() : "",
        modalidad: typeof x?.modalidad === "string" ? x.modalidad.trim().toLowerCase() : "",
        sede: typeof x?.sede === "string" ? x.sede.trim() : "",
        periodoId: typeof x?.periodoId === "string" ? x.periodoId.trim() : "",
        fuente: x?.fuente === "firebase_utet" ? "firebase_utet" : "manual"
      }));
      if (datos.some(x => !/^[0-9]{10}$/.test(x.cedula) || x.carrera.length > 120 ||
          x.sede.length > 120 || x.periodoId.length > 120 ||
          !["", "articulo", "complexivo", "trabajo"].includes(x.modalidad) ||
          (!x.carrera && !x.modalidad)))
        return json(req, 400, { error: "clasificacion_invalida" });
      let guardadas = 0;
      for (const x of datos) {
        const updated = await q(`insert into doctorado_clasificacion
          (cedula, carrera, modalidad, sede, periodo_id, fuente, sincronizado_en)
          values ($1, $2, $3, $4, $5, $6, case when $6 = 'firebase_utet' then now() else null end)
          on conflict (cedula) do update set
          carrera = case when excluded.carrera <> '' then excluded.carrera else doctorado_clasificacion.carrera end,
          modalidad = case when excluded.modalidad <> '' then excluded.modalidad else doctorado_clasificacion.modalidad end,
          sede = case when excluded.sede <> '' then excluded.sede else doctorado_clasificacion.sede end,
          periodo_id = case when excluded.periodo_id <> '' then excluded.periodo_id else doctorado_clasificacion.periodo_id end,
          fuente = excluded.fuente,
          sincronizado_en = case when excluded.fuente = 'firebase_utet' then now()
            else doctorado_clasificacion.sincronizado_en end,
          actualizado = now()
          returning cedula`,
          x.cedula, x.carrera, x.modalidad, x.sede, x.periodoId, x.fuente);
        guardadas += updated.length;
      }
      return json(req, 200, { guardadas });
    }
    if (ruta === "POST /admin/clave") {
      const nueva = String((await body(req)).nueva || "");
      if (nueva.length < 8 || nueva.length > 200) return json(req, 400, { error: "corta" });
      await q("update doctorado_admins set clave_hash = crypt($1, gen_salt('bf', 10)) where email = $2", nueva, s.email);
      await q("delete from doctorado_sesiones where email = $1 and token_hash <> $2", s.email, s.tokenHash);
      return json(req, 200, { ok: true });
    }
    if (ruta === "POST /admin/importar") {
      const lista = (await body(req)).filas;
      if (!Array.isArray(lista) || lista.length > 500) return json(req, 400, { error: "invalida" });
      let guardadas = 0;
      for (const r of lista) {
        const f = limpiar(r);
        const fecha = typeof r?.created_at === "string" && !Number.isNaN(Date.parse(r.created_at)) ? r.created_at : null;
        if (f && await insertar(f, "respaldo", fecha)) guardadas++;
      }
      return json(req, 200, { guardadas });
    }
    if (ruta === "POST /admin/salir") {
      await q("delete from doctorado_sesiones where token_hash = $1", s.tokenHash);
      return json(req, 200, { ok: true });
    }
  }
  return json(req, 404, { error: "ruta" });
}

export default {
  async fetch(req) {
    try { return await manejar(req); }
    catch (e) {
      if (e instanceof SyntaxError || e?.message === "grande") return json(req, 400, { error: "invalida" });
      console.error(e);
      return json(req, 500, { error: "servidor" });
    }
  }
};
