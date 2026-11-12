# Encuestas de titulación · ITSQMET

Cuatro encuestas de 10 preguntas y un panel privado: tres para el proceso por artículo académico
(inicio, en proceso, finalización) y una para estudiantes que se gradúan por examen complexivo o trabajo de titulación.
Sitio estático en GitHub Pages. Base principal: **Neon**. Respaldo: **Firebase** (y Supabase, opcional).

## Enlaces

- Inicio: https://jeffer91.github.io/doctorado/#/inicio
- En proceso: https://jeffer91.github.io/doctorado/#/proceso
- Finalización: https://jeffer91.github.io/doctorado/#/final
- Examen o trabajo de titulación (estudiantes sin la modalidad de artículo): https://jeffer91.github.io/doctorado/#/regulares
- Administrador: https://jeffer91.github.io/doctorado/#/admin

## Cómo funciona

1. El estudiante escribe su cédula, acepta participar y responde una pregunta por pantalla.
2. La respuesta se guarda en Neon y, además, una copia en cada respaldo configurado.
   Si la principal falla, el respaldo conserva el registro.
3. Solo se admite una respuesta por cédula y etapa; no se puede modificar ni borrar.
4. El panel lee Neon. «Revisar respaldo» compara con Firebase y recupera lo que falte.

## Neon (principal)

- Proyecto `doctorado-itsqmet`. Esquema: `neon/001_doctorado.sql`.
- Nadie accede a las tablas desde el navegador. Todo pasa por la función `encuestas`
  (`neon/function/index.js`), cuya dirección está en `src/config.js`:
  - `POST /respuestas`: valida y guarda (201) o avisa que ya existe (409).
  - `/admin/*`: acceso con correo y contraseña (bcrypt), sesión de 12 horas y bloqueo tras 8 intentos fallidos.
- `codigo` es un seudónimo estable por cédula (sal secreta en `doctorado_config`): une etapas sin exponer la cédula.
- Para publicar cambios de la función: `npm run build` en `neon/function` y desplegar `dist/index.mjs` en un zip.

## Firebase (respaldo)

1. Secreto `FIREBASE_WEB_CONFIG` en GitHub Actions (JSON de configuración web), o pegar el objeto en `FIREBASE_FIJO` de `src/config.js`.
2. Authentication: habilitar **Anónimo** y **Google**; autorizar el dominio `jeffer91.github.io`.
3. Firestore Rules: insertar el bloque de `firestore.reglas-insertar.txt` (sin reemplazar las reglas existentes).

Sin estos pasos la app funciona solo con Neon.

## Supabase (respaldo opcional)

Aplicar `supabase/migrations/001_doctorado.sql` en un proyecto y poner su URL y clave pública en `SUPABASE` de `src/config.js`.

## Datos

Columnas: `se1`–`se5` (autoeficacia, idénticas en las tres etapas), `p6`, `p7`, `horas`, `horas_ns` (no sabe),
`dificultad`, `dificultad_otra`, `ia`, `omitidas` (preguntas con «prefiero no responder»), `etapa`, `version`, `created_at`, `origen`.

Encuesta «examen o trabajo de titulación» (tabla `doctorado_regulares`): `gusto`, `eleccion`, `razon_si`, `razon_no`, `preparacion`, `formacion`,
`dificultad`, `apoyo`, `aporte_articulo`, `aporte_examen`, cada opción «otra» con su texto en `*_otra`. Una respuesta por cédula.
El `codigo` es el mismo en todas las encuestas.

El CSV seudonimizado no incluye la cédula; el CSV con cédula sirve para vincular notas y debe guardarse protegido.

## Límites

- La cédula se valida por formato y dígito verificador, pero no comprueba identidad ni matrícula: no hay padrón institucional conectado.
- Los instrumentos son una versión preliminar, no una escala validada.

## Desarrollo

`npm test` y `npm run check` (sitio); `npm test` en `neon/function` (función, con Postgres embebido). Para ver el sitio en local: `python3 -m http.server` en la raíz.


## Panel de administración organizado

El panel en `#/admin` incorpora un menú lateral con:

- Resumen general: estudiantes únicos, respuestas, etapas y modalidades.
- Artículo académico: total, inicio, proceso y finalización.
- Otras modalidades: grupo de comparación, examen complexivo, trabajo de titulación y pendientes de clasificar.
- Análisis: tabla por carrera y registro de respuestas.
- Gestión: clasificación administrativa, exportación CSV, respaldo y enlaces.

Los filtros de carrera, rango de fechas y búsqueda por cédula/código se aplican
a los módulos y a las exportaciones. La modalidad real es independiente de
la **modalidad preferida** que el estudiante responde en el cuestionario.

### Clasificación de carreras y modalidad real

Las encuestas históricas no contienen carrera ni modalidad real. La información
se mantiene separada de las respuestas en la tabla `doctorado_clasificacion`
(creada por `neon/001_doctorado.sql`) y se asocia únicamente mediante cédula.

Desde Administración → Configuración → «Clasificar estudiantes» pega los datos
institucionales verificados en el formato:

```text
cedula;carrera;modalidad
[cedula del estudiante];Enfermería;complexivo
[cedula del estudiante];Software;articulo
```

Modalidades aceptadas: `articulo`, `complexivo`, `trabajo` (o vacía). Una fila
por estudiante, máximo 500 por lote. La acción está protegida por autenticación
administrativa, puede actualizar la clasificación sin cambiar las respuestas,
y no deduce la modalidad real de la pregunta sobre preferencias.

Si todavía no se ha cargado la clasificación, los registros se muestran
como «Sin carrera» o «Sin clasificar». No deben interpretarse esos estados
como ausencia de estudiantes en una carrera.


## Vinculación con Firebase UTET (carreras y modalidades)

El panel administrativo consulta de forma autenticada el proyecto `utet-4387a` 
de Requisitos. La configuración web pública está en `src/config.js`, en la constante
`UTET_FIREBASE`. **Esta conexión es distinta del respaldo de encuestas Firebase**.

La integración lee únicamente documentos que corresponden a cédulas que respondieron:
- `Estudiante` y `Estudiantes` (legado): carrera/sede actual.
- `matriculas` y `EstudiantesPeriodo` (legado): carrera, sede, período y modalidad real.

El mapeo está en `src/utet-map.js`; la lectura Firebase en `src/firebase-utet.js`.
No se importan nombres, correos, teléfonos ni calificaciones al panel doctoral.

### Primer uso
1. Firebase Console, proyecto UTET > Authentication: habilitar proveedor Google
   y autorizar `jeffer91.github.io` como dominio permitido.
2. Revisar las reglas de Firestore para que **solo el administrador autorizado**
   pueda leer las colecciones utilizadas por Doctorado, sin afectar la app Requisitos.
3. Abrir `#/admin`, ingresar a Neon, pulsar **Sincronizar ahora con Firebase UTET**
   e iniciar sesión con Google usando el correo administrador.
4. La aplicación cruza cédulas, guarda carreras y modalidades en
   `doctorado_clasificacion` de Neon y permite ver las coincidencias.
5. Después de la vinculación, vuelve a verificar datos al abrir el panel
   y aproximadamente cada 15 minutos **mientras el panel esté abierto**.

No existe una sincronización de servidor cuando el navegador está cerrado.
Para eso sería necesario configurar un servicio backend con credenciales
de acceso de mínimo privilegio a Firebase, nunca incrustadas en GitHub Pages.

### Advertencia sobre reglas de Firestore
Las reglas globales `allow read, write: if true` dejan datos institucionales
expuestos a cualquier persona. **No utilizar estas reglas como autorización**;
es necesario eliminarlas y definir permisos por colección y rol, comprobando
primero todos los usos de Requisitos para no interrumpirla.
Si una regla pública más general continúa vigente, una regla más restrictiva
en otra ruta NO anula ese permiso.

La sincronización administrativa jamás escribe en Firebase UTET, solo lee
datos académicos y guarda la clasificación en Neon.
