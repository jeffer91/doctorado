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


## Panel por período académico

El panel privado `#/admin` exige seleccionar primero un período académico. El catálogo
se obtiene de Neon, sincronizado desde Firebase UTET: **no se inventan períodos**.
Después se habilitan los filtros de carrera, sede, fechas y búsqueda. Las vistas incluyen
artículo (inicio/proceso/finalización), grupo de comparación (examen/trabajo),
distribución por carrera y respuestas sin período.

El backend no mezcla automáticamente encuestas de un estudiante que tenga matrículas
de varios períodos. En esos casos, el administrador puede asociar **una encuesta concreta**
al período comprobado desde «Período pendiente». Esta asignación queda persistida
en `doctorado_asignaciones` con fuente `manual`.

Las encuestas nuevas enviadas con el enlace
`#/inicio?periodo=<id_real_del_periodo>` registran directamente el período en Neon.
No se alteran las respuestas históricas ni se atribuyen períodos por suposición.

## Fuente institucional Firebase UTET → base oficial Neon

- Firebase: proyecto `utet-4387a`, colección de períodos `periodos` y matrículas
  `matriculas` (con lectura compatible de `EstudiantesPeriodo`).
- Neon: `doctorado_periodos`, `doctorado_matriculas`,
  `doctorado_asignaciones`, `doctorado_sync_estado`.
- Coincidencias: solo cédulas que han respondido una encuesta; cada matrícula
  tiene clave compuesta `(cedula,periodo_id)`.
- Persistencia: las matrículas se insertan o actualizan en Neon por lotes,
  sin sobreescribir las respuestas de investigación ni copiar datos de contacto.
- Asignación histórica automática: solo si la cédula tiene una única matrícula
  identificada. Las posibles ambigüedades quedan pendientes de confirmación.
- No se usa la modalidad preferida indicada en la encuesta como si fuera la
  modalidad real de titulación.

### Sincronización automática de servidor

Archivo: `.github/workflows/sync-utet.yml`. Se programa cada 30 minutos
(incluso con el navegador cerrado) y admite ejecución manual desde Actions.
El script `scripts/sync-utet.mjs` utiliza la API de Firestore con autorización
de cuenta de servicio y la API SQL sobre HTTPS de Neon.

**Para activar las ejecuciones reales**, configurar en GitHub → Settings →
Secrets and variables → Actions → Repository secrets:

1. `FIREBASE_UTET_SERVICE_ACCOUNT_JSON`: JSON de una **cuenta de servicio
   dedicada**, con acceso de solo lectura a Firestore del proyecto `utet-4387a`
   (p. ej. rol Cloud Datastore Viewer). No incluirla en Git ni en GitHub Pages.
2. `NEON_DATABASE_URL`: cadena de conexión PostgreSQL para `doctorado-itsqmet`
   mediante un rol autorizado para consultar las cédulas de las encuestas y
   actualizar únicamente las tablas de sincronización.
   
Antes de agregar ambos secretos, el flujo se detiene sin importar estudiantes.
Por seguridad, no utiliza reglas públicas ni el `apiKey` de la aplicación
web para realizar una lectura administrativa.

Después de configurar los secretos, abrir el flujo
«Sincronizar Firebase UTET con Neon» en GitHub Actions, ejecutarlo y verificar
que indique `Sincronización completada` con cantidades plausibles. La pantalla
administrativa mostrará la fecha/estado del último cruce. Si no existen matrículas
verificables, el proceso informa del error sin inventar carreras.

### Seguridad

Las reglas `allow read, write: if true` son inseguras y deben corregirse
en Firebase Console teniendo en cuenta los accesos de Requisitos. Ninguna regla
más restrictiva anula una regla general que permita todo. La sincronización
programada utiliza una identidad de servicio y permisos IAM; no requiere abrir
Firestore al público.

### Pruebas y despliegue

- `npm test` y `npm run check` para frontend y mapeo de matrículas.
- `cd neon/function && npm ci && npm test && npm run build` para la función.
- GitHub Pages se publica al hacer push a `main`.
- La función Neon se despliega por separado con el bundle generado en
  `neon/function`; cambiar el código en GitHub no modifica automáticamente
  la función publicada.
