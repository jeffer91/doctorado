import test from "node:test";
import assert from "node:assert/strict";
import { STAGES, ARTICULO, QUESTIONS, IDS, cedulaValida, toRow } from "../src/questions.js";

test("cuatro encuestas de diez preguntas; las tres de artículo comparten códigos", () => {
  assert.deepEqual(Object.keys(STAGES), ["inicio", "proceso", "final", "regulares"]);
  for (const stage of Object.keys(STAGES)) assert.equal(QUESTIONS[stage].length, 10, stage);
  for (const stage of ARTICULO) assert.deepEqual(QUESTIONS[stage].map(q => q.id), IDS, stage);
  assert.equal(new Set(QUESTIONS.regulares.map(q => q.id)).size, 10);
});

test("se1–se5 son idénticas en las tres etapas", () => {
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(QUESTIONS.proceso[i], QUESTIONS.inicio[i]);
    assert.deepEqual(QUESTIONS.final[i], QUESTIONS.inicio[i]);
  }
});

test("validación de cédula", () => {
  assert.equal(cedulaValida("1710034065"), true);
  assert.equal(cedulaValida("1710034066"), false);
  assert.equal(cedulaValida("171003406"), false);
  assert.equal(cedulaValida("9910034065"), false);
});

test("la fila distingue valor, no sabe y prefiero no responder", () => {
  const a = { se1: "4", se2: "NR", se3: "3", se4: "5", se5: "1", p6: "2", p7: "3", horas: "NS", dificultad: "otra", dificultad_otra: " tutor ", ia: "5" };
  const row = toRow("inicio", "1710034065", a);
  assert.equal(row.se1, 4);
  assert.equal(row.se2, null);
  assert.deepEqual(row.omitidas, ["se2"]);
  assert.equal(row.horas, null);
  assert.equal(row.horas_ns, true);
  assert.equal(row.dificultad_otra, "tutor");
  assert.equal(toRow("final", "1710034065", { ...a, horas: "7,5", dificultad: "tiempo" }).horas, 7.5);
  assert.equal(toRow("final", "1710034065", { ...a, dificultad: "tiempo" }).dificultad_otra, null);
  assert.throws(() => toRow("inicio", "1710034065", { ...a, ia: undefined }));
});
