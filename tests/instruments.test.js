import test from "node:test";
import assert from "node:assert/strict";
import {STAGES, QUESTIONS, validateInstrument} from "../src/questions.js";

test("tres etapas con diez preguntas cada una",()=>{
  assert.equal(Object.keys(STAGES).length,3);
  assert.equal(validateInstrument(),true);
  for (const [stage,questions] of Object.entries(QUESTIONS)){
    assert.equal(questions.length,10,stage);
    assert.deepEqual(questions.map(q=>q.id),Array.from({length:10},(_,i)=>"q"+(i+1)));
  }
});

test("preguntas transversales comparables sin fechas",()=>{
  const groups=Object.values(QUESTIONS);
  for (const q of groups) {
    assert.deepEqual(q[0].options,groups[0][0].options);
    assert.deepEqual(q[8].options,groups[0][8].options);
    assert.equal(q[9].type,"text");
    assert.equal(q[9].optional,true);
    assert.ok(q.every(x=>!/\b(2025|2026|2027)\b/.test(x.question)));
  }
  assert.deepEqual(QUESTIONS.inicio[3].rows,QUESTIONS.desarrollo[3].rows);
  assert.deepEqual(QUESTIONS.inicio[3].rows,QUESTIONS.finalizados[2].rows);
});

test("las preguntas de selección múltiple tienen reglas de límite",()=>{
  for (const questions of Object.values(QUESTIONS)) for (const q of questions) {
    if(q.type==="multi") {
      assert.ok(q.options.length>=2);
      if(q.max)assert.ok(q.max<=2);
    }
  }
});

test("respuestas abiertas son optativas y limitadas",()=>{
  for (const questions of Object.values(QUESTIONS)) {
    assert.equal(questions[9].maxLength,600);
    assert.equal(questions[9].optional,true);
  }
});
