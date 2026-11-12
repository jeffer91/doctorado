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
