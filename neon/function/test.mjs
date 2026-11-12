// Prueba local de la función contra un Postgres embebido (pglite).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fn, { usarSql } from "./index.js";

const db = new PGlite({ extensions: { pgcrypto } });
await db.exec(readFileSync(new URL("../001_doctorado.sql", import.meta.url), "utf8"));
await db.query("insert into doctorado_admins values ('a@b.c', crypt('secreta123', gen_salt('bf', 4)))");
// Igual que el protocolo HTTP de Neon: parámetros de texto, filas como listas de texto.
usarSql(async (query, params) => (await db.query(query, params, { rowMode: "array" })).rows.map(r => r.map(v => (v === null ? null : String(v)))));
const call = (method, path, body, token) => fn.fetch(new Request("https://x" + path, {
  method, headers: { origin: "https://jeffer91.github.io", ...(token ? { authorization: "Bearer " + token } : {}) },
  body: body ? JSON.stringify(body) : undefined
}));
const fila = { etapa: "inicio", cedula: "1710034065", version: 1, horas_ns: true, omitidas: ["se3"], se1: 1, se2: 2, se3: null, se4: 4, se5: 5, p6: 1, p7: 2, horas: null, dificultad: "otra", ia: 5, dificultad_otra: "tutor" };

test("salud y CORS", async () => {
  const r = await call("GET", "/salud");
  assert.deepEqual(await r.json(), { ok: true });
  assert.equal(r.headers.get("access-control-allow-origin"), "https://jeffer91.github.io");
  assert.equal((await call("OPTIONS", "/respuestas")).status, 204);
});
test("guardar, duplicado e inválidas", async () => {
  assert.equal((await call("POST", "/respuestas", fila)).status, 201);
  assert.equal((await call("POST", "/respuestas", fila)).status, 409);
  assert.equal((await call("POST", "/respuestas", { ...fila, etapa: "final" })).status, 201);
  assert.equal((await call("POST", "/respuestas", { ...fila, cedula: "2", etapa: "proceso" })).status, 400);
  assert.equal((await call("POST", "/respuestas", { ...fila, etapa: "proceso", se1: 9 })).status, 400);
  assert.equal((await call("POST", "/respuestas", { ...fila, etapa: "proceso", se3: 3 })).status, 400);
  assert.equal((await call("POST", "/respuestas", { ...fila, etapa: "proceso", horas: 5 })).status, 400);
  assert.equal((await fn.fetch(new Request("https://x/respuestas", { method: "POST", body: "{" }))).status, 400);
});
test("panel: acceso, lectura, importación y cambio de clave", async () => {
  assert.equal((await call("GET", "/admin/respuestas")).status, 401);
  assert.equal((await call("POST", "/admin/login", { email: "a@b.c", clave: "mala" })).status, 401);
  const { token } = await (await call("POST", "/admin/login", { email: "A@b.c", clave: "secreta123" })).json();
  const { filas } = await (await call("GET", "/admin/respuestas", null, token)).json();
  assert.equal(filas.length, 2);
  assert.equal(filas[0].codigo.length, 12);
  assert.equal(filas[0].codigo, filas[1].codigo);
  assert.deepEqual(filas[0].omitidas, ["se3"]);
  const imp = await (await call("POST", "/admin/importar", { filas: [fila, { ...fila, etapa: "proceso", horas: 7.5, horas_ns: false, created_at: "2026-01-02T03:04:05Z" }] }, token)).json();
  assert.equal(imp.guardadas, 1);
  const todas = (await (await call("GET", "/admin/respuestas", null, token)).json()).filas;
  const p = todas.find(x => x.etapa === "proceso");
  assert.equal(p.horas, 7.5); assert.equal(p.origen, "respaldo"); assert.ok(String(p.created_at).startsWith("2026-01-02"));
  assert.equal((await call("POST", "/admin/clave", { nueva: "corta" }, token)).status, 400);
  assert.equal((await call("POST", "/admin/clave", { nueva: "otraclave99" }, token)).status, 200);
  assert.equal((await call("POST", "/admin/login", { email: "a@b.c", clave: "secreta123" })).status, 401);
  assert.equal((await call("POST", "/admin/login", { email: "a@b.c", clave: "otraclave99" })).status, 200);
  assert.equal((await call("POST", "/admin/salir", null, token)).status, 200);
  assert.equal((await call("GET", "/admin/respuestas", null, token)).status, 401);
});
test("encuesta de estudiantes regulares", async () => {
  const reg = { etapa: "regulares", cedula: "1710034065", omitidas: ["razon_no", "aporte_examen"], gusto: 5, eleccion: "articulo", razon_si: "otra", razon_si_otra: "x", razon_no: null, preparacion: 3, formacion: 2, dificultad: "tema", apoyo: "tutor", aporte_articulo: 4, aporte_examen: null };
  assert.equal((await call("POST", "/respuestas", reg)).status, 201);
  assert.equal((await call("POST", "/respuestas", reg)).status, 409);
  assert.equal((await call("POST", "/respuestas", { ...reg, cedula: "0102030400", dificultad: "tecnologia" })).status, 400);
  assert.equal((await call("POST", "/respuestas", { ...reg, cedula: "0102030400", eleccion: null })).status, 400);
  const { token } = await (await call("POST", "/admin/login", { email: "a@b.c", clave: "otraclave99" })).json();
  const d = await (await call("GET", "/admin/respuestas", null, token)).json();
  assert.equal(d.regulares.length, 1);
  assert.equal(d.regulares[0].razon_si_otra, "x");
  assert.deepEqual(d.regulares[0].omitidas, ["razon_no", "aporte_examen"]);
  assert.equal(d.regulares[0].codigo, d.filas[0].codigo); // mismo seudónimo que en las otras encuestas
  assert.equal(d.filas[0].horas === null || typeof d.filas[0].horas === "number", true);
  const imp = await (await call("POST", "/admin/importar", { filas: [reg, { ...reg, cedula: "0102030400" }] }, token)).json();
  assert.equal(imp.guardadas, 1);
});
test("bloqueo tras muchos intentos fallidos", async () => {
  let last;
  for (let i = 0; i < 9; i++) last = (await call("POST", "/admin/login", { email: "x@y.z", clave: "no" })).status;
  assert.equal(last, 429);
});

test("clasificación por carrera y modalidad sin modificar encuestas", async () => {
  const { token } = await (await call("POST", "/admin/login", { email: "a@b.c", clave: "otraclave99" })).json();
  const body = { filas: [{ cedula: "1710034065", carrera: "Enfermería", modalidad: "complexivo" }] };
  assert.equal((await call("POST", "/admin/clasificar", body)).status, 401);
  assert.equal((await call("POST", "/admin/clasificar", { filas: [{ ...body.filas[0], modalidad: "no-real" }] }, token)).status, 400);
  const res = await call("POST", "/admin/clasificar", body, token);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).guardadas, 1);
  const data = await (await call("GET", "/admin/respuestas", null, token)).json();
  assert.equal(data.filas[0].carrera, "Enfermería");
  assert.equal(data.regulares.find(x => x.cedula === body.filas[0].cedula).modalidad, "complexivo");
  assert.equal(data.filas[0].se1, 1);
});
