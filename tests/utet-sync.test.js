import test from "node:test";
import assert from "node:assert/strict";
import { convertirMatriculas, modalidad } from "../scripts/utet-normalizar.mjs";
const c="1710034065";
test("normaliza matrículas por cédula y período sin combinar carreras distintas",()=>{
  const docs=[
    {id:"2025B__"+c,collection:"matriculas",data:{cedula:c,periodoId:"2025B",nombreCarrera:"Software",modalidadTitulacion:"Artículo académico",sede:"Matriz"}},
    {id:"2026A__"+c,collection:"matriculas",data:{cedula:c,periodoId:"2026A",nombreCarrera:"Enfermería",modalidadTitulacion:"Examen complexivo",sede:"Manta"}},
    {id:"2026A__0999999999",collection:"matriculas",data:{cedula:"0999999999",periodoId:"2026A",nombreCarrera:"Contabilidad"}}
  ];
  const x=convertirMatriculas(docs,[c],[{id:"2026A",data:{label:"Abril–Septiembre 2026"}}]);
  assert.equal(x.matriculas.length,2);
  assert.equal(x.matriculas.find(r=>r.periodo_id==="2026A").carrera,"Enfermería");
  assert.equal(x.matriculas.find(r=>r.periodo_id==="2025B").carrera,"Software");
  assert.equal(x.periodos.find(r=>r.periodo_id==="2026A").nombre,"Abril–Septiembre 2026");
  assert.ok(!JSON.stringify(x).includes("0999999999"));
});
test("extrae identidad del ID remoto y prefiere datos vigentes",()=>{
  const docs=[
    {id:"octubre 2025 marzo 2026__"+c,collection:"EstudiantesPeriodo",data:{NombreCarrera:"Software",Modalidad:"TRABAJO DE TITULACIÓN"}},
    {id:"octubre 2025 marzo 2026__"+c,collection:"matriculas",data:{NombreCarrera:"Software",modalidadTitulacion:"Examen complexivo"}}
  ];
  const x=convertirMatriculas(docs,[c]);
  assert.equal(x.matriculas.length,1);
  assert.equal(x.matriculas[0].modalidad,"complexivo");
  assert.equal(x.matriculas[0].periodo_id,"octubre 2025 marzo 2026");
});
test("sin período comprobable, no asigna la carrera actual a ningún período",()=>{
  assert.deepEqual(convertirMatriculas([{id:c,collection:"Estudiante",data:{cedula:c,nombreCarreraActual:"Enfermería"}}],[c]).matriculas,[]);
  assert.equal(modalidad("ninguna"),"");
});
