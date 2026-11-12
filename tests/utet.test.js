import test from "node:test";
import assert from "node:assert/strict";
import { cruzarUtet, modalidadDe } from "../src/utet-map.js";
const c1="1710034065", c2="1710034066";
test("homologa únicamente modalidades explícitas", () => {
 assert.equal(modalidadDe("EXAMEN COMPLEXIVO"),"complexivo");
 assert.equal(modalidadDe("Artículo Académico"),"articulo");
 assert.equal(modalidadDe("Trabajo de Titulación"),"trabajo");
 assert.equal(modalidadDe(""),"");
 assert.equal(modalidadDe("en proceso"),"");
});
test("cruza por cédula y prioriza matrícula sobre carrera personal", () => {
 const docs={
  Estudiante:[{id:c1,data:{nombreCarreraActual:"Marketing Digital",sede:"Matriz"}}],
  matriculas:[
   {id:"abril 2025 septiembre 2025__"+c1,data:{cedula:c1,periodoId:"abril 2025 septiembre 2025",nombreCarrera:"Software",modalidadTitulacion:"Artículo Académico",sede:"Sur"}},
   {id:"abril 2026 septiembre 2026__"+c1,data:{cedula:c1,periodoId:"abril 2026 septiembre 2026",nombreCarrera:"Enfermería",modalidadTitulacion:"Examen Complexivo",sede:"Manta"}}
  ],
  Estudiantes:[],
  EstudiantesPeriodo:[]
 };
 const x=cruzarUtet([c1,c2],docs);
 assert.equal(x.filas.length,1);
 assert.deepEqual(x.filas[0],{cedula:c1,carrera:"Enfermería",modalidad:"complexivo",sede:"Manta",periodoId:"abril 2026 septiembre 2026",fuente:"firebase_utet"});
 assert.equal(x.sinCoincidencia,1);
});
test("soporta colección legada y no incorpora contacto personal",() => {
 const x=cruzarUtet([c1],{
   Estudiante:[],matriculas:[],
   Estudiantes:[{id:c1,data:{Cedula:c1,NombreCarrera:"Contabilidad",CorreoPersonal:"privado@ejemplo.com"}}],
   EstudiantesPeriodo:[{id:"abril 2026 septiembre 2026__"+c1,data:{Cedula:c1,Periodo:"abril 2026 septiembre 2026",Carrera:"Contabilidad",Modalidad:"Trabajo de titulación"}}]
 });
 assert.equal(x.filas[0].carrera,"Contabilidad");
 assert.equal(x.filas[0].modalidad,"trabajo");
 assert.ok(!JSON.stringify(x.filas).includes("privado@"));
});
test("no inventa carreras ni modalidades y omite estudiantes sin datos útiles",() => {
 const x=cruzarUtet([c1],{Estudiante:[{id:c1,data:{nombres:"Persona"}}],matriculas:[]});
 assert.equal(x.encontradas,1);
 assert.equal(x.filas.length,0);
});
