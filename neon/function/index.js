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
const ESCALAS = ["se1", "se2", "se3", "se4", "se5", "p6", "p7", "ia"];
const IDS = [...ESCALAS, "horas", "dificultad"];
const DIFICULTADES = ["tema", "bibliografia", "metodologia", "analisis", "redaccion", "tiempo", "tecnologia", "otra"];
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
function limpiar(r) {
  if (!r || typeof r !== "object") return null;
  if (!["inicio", "proceso", "final"].includes(r.etapa)) return null;
  if (typeof r.cedula !== "string" || !/^\d{10}$/.test(r.cedula)) return null;
  const omitidas = Array.isArray(r.omitidas) ? [...new Set(r.omitidas)].filter(x => IDS.includes(x)) : [];
  const f = { etapa: r.etapa, cedula: r.cedula, omitidas, horas_ns: r.horas_ns === true };
  for (const k of ESCALAS) {
    const v = r[k] ?? null;
    if (v !== null && !(Number.isInteger(v) && v >= 1 && v <= 5)) return null;
    if ((v !== null) === omitidas.includes(k)) return null;
    f[k] = v;
  }
  const h = r.horas ?? null;
  if (h !== null && !(typeof h === "number" && h >= 0 && h <= 100)) return null;
  if ((h !== null) + f.horas_ns + omitidas.includes("horas") !== 1) return null;
  f.horas = h === null ? null : Math.round(h * 10) / 10;
  const d = r.dificultad ?? null;
  if (d !== null && !DIFICULTADES.includes(d)) return null;
  if ((d !== null) === omitidas.includes("dificultad")) return null;
  f.dificultad = d;
  const otra = typeof r.dificultad_otra === "string" ? r.dificultad_otra.trim().slice(0, 200) : "";
  f.dificultad_otra = d === "otra" && otra ? otra : null;
  return f;
}

async function insertar(f, origen = "web", fecha = null) {
  const filas = await q(
    `insert into doctorado_respuestas
       (etapa, cedula, se1, se2, se3, se4, se5, p6, p7, ia, horas, horas_ns, dificultad, dificultad_otra, omitidas, origen, created_at)
     values ($1, $2, $3::smallint, $4::smallint, $5::smallint, $6::smallint, $7::smallint, $8::smallint, $9::smallint, $10::smallint,
             $11::numeric(4,1), $12::boolean, $13, $14, $15::text[], $16, coalesce($17::timestamptz, now()))
     on conflict (etapa, cedula) do nothing
     returning id::text`,
    f.etapa, f.cedula, f.se1, f.se2, f.se3, f.se4, f.se5, f.p6, f.p7, f.ia,
    f.horas, f.horas_ns, f.dificultad, f.dificultad_otra, "{" + f.omitidas.join(",") + "}", origen, fecha);
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
      const [[texto]] = await q(
        `select coalesce(json_agg(t order by t.created_at desc), '[]')::text from (
           select id, cedula, codigo, etapa, created_at, version, se1, se2, se3, se4, se5, p6, p7,
                  horas, horas_ns, dificultad, dificultad_otra, ia, omitidas, origen
           from doctorado_respuestas) t`);
      return json(req, 200, { filas: JSON.parse(texto) });
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
