# Encuestas de titulación · ITSQMET

Tres encuestas de 10 preguntas (inicio, en proceso, finalización) y un panel privado.
Sitio estático en GitHub Pages. Base principal: **Supabase**. Respaldo: **Firebase**.

## Enlaces

- Inicio: https://jeffer91.github.io/doctorado/#/inicio
- En proceso: https://jeffer91.github.io/doctorado/#/proceso
- Finalización: https://jeffer91.github.io/doctorado/#/final
- Administrador: https://jeffer91.github.io/doctorado/#/admin

## Cómo funciona

1. El estudiante escribe su cédula, acepta participar y responde una pregunta por pantalla.
2. La respuesta se guarda en Supabase y, además, una copia en Firebase.
   Si una de las dos falla, la otra conserva el registro.
3. Solo se admite una respuesta por cédula y etapa; no se puede modificar ni borrar.
4. El panel lee Supabase. «Revisar respaldo» compara con Firebase y recupera lo que falte.

## Supabase (principal)

- Esquema: `supabase/migrations/001_doctorado.sql`.
- Tabla `doctorado_respuestas`: el público solo puede insertar; solo el administrador puede leer (RLS).
- `codigo` es un seudónimo estable por cédula (sal secreta en `doctorado_priv.config`): permite unir etapas sin exponer la cédula.
- La URL y la clave pública van en `src/config.js` (no son secretas).
- Administradores: correos en `doctorado_priv.admins`, con usuario en Supabase Auth.

## Firebase (respaldo)

1. Secreto `FIREBASE_WEB_CONFIG` en GitHub Actions (JSON de configuración web), o pegar el objeto en `FIREBASE_FIJO` de `src/config.js`.
2. Authentication: habilitar **Anónimo** y **Google**; autorizar el dominio `jeffer91.github.io`.
3. Firestore Rules: insertar el bloque de `firestore.reglas-insertar.txt` (sin reemplazar las reglas existentes).

Sin estos pasos la app funciona solo con Supabase.

## Datos

Columnas: `se1`–`se5` (autoeficacia, idénticas en las tres etapas), `p6`, `p7`, `horas`, `horas_ns` (no sabe),
`dificultad`, `dificultad_otra`, `ia`, `omitidas` (preguntas con «prefiero no responder»), `etapa`, `version`, `created_at`, `origen`.

El CSV seudonimizado no incluye la cédula; el CSV con cédula sirve para vincular notas y debe guardarse protegido.

## Límites

- La cédula se valida por formato y dígito verificador, pero no comprueba identidad ni matrícula: no hay padrón institucional conectado.
- Los instrumentos son una versión preliminar, no una escala validada.

## Desarrollo

`npm test` y `npm run check`. Para ver el sitio en local: `python3 -m http.server` en la raíz.
