# Doctorado · Investigación formativa ITSQMET

Aplicación web adaptable para administrar tres encuestas diferentes de 10 preguntas dirigidas a estudiantes que inician, desarrollan o terminaron el artículo académico. Incluye un panel privado con resultados, filtros por carrera y etapa, gráficos y exportación CSV.

## Enlaces previstos en GitHub Pages

Cuando GitHub Pages esté habilitado:

- Inicio: https://jeffer91.github.io/doctorado/#/inicio
- Desarrollo: https://jeffer91.github.io/doctorado/#/desarrollo
- Finalizados: https://jeffer91.github.io/doctorado/#/finalizados
- Administrador: https://jeffer91.github.io/doctorado/#/admin

La ruta del administrador no es la protección: la autorización se aplica en Firestore Rules, con Google y correo verificado.

## Activación obligatoria antes de recopilar datos

1. En GitHub → Settings → Secrets and variables → Actions → New repository secret crea FIREBASE_WEB_CONFIG. Su valor será el objeto JSON con todos los campos públicos de Configuración web obtenidos de Firebase → Configuración del proyecto → General → Tus apps → Config. El flujo de publicación generará runtime-config.js automáticamente. En este repositorio solo se incluye una configuración nula; hasta realizar este paso no se enviarán respuestas.

   Ejemplo de estructura, reemplazando valores: {"apiKey":"TU_CONFIG_WEB","authDomain":"proyecto.firebaseapp.com","projectId":"proyecto","storageBucket":"proyecto.firebasestorage.app","messagingSenderId":"numero","appId":"identificador"}

2. En Firebase UTET (utet-4387a) → Authentication → Sign-in method habilita los proveedores Anónimo (respuestas estudiantiles) y Google (administrador). En Authentication → Settings → Authorized domains incorpora jeffer91.github.io.

3. En Firestore → Rules abre firestore.reglas-insertar.txt y COPIA SOLO SU BLOQUE MATCH dentro de las reglas ya existentes, bajo match /databases/{database}/documents. NO reemplaces las reglas existentes porque UTET se utiliza también en otras aplicaciones. La lectura de las respuestas está restringida a la cuenta de Google verificada indicada en ese bloque. Si el administrador utiliza otra cuenta, modifica esa dirección en Firestore Rules antes de publicarlas.

4. En GitHub → Settings → Pages selecciona Build and deployment → Source: GitHub Actions. Se publicará la rama main mediante .github/workflows/pages.yml. Después de añadir el secreto ejecuta Actions → Publicar Doctorado → Run workflow o realiza un nuevo commit.

5. Prueba primero una participación autorizada. Verifica que se guarde en la colección doctorado_respuestas, que el administrador autorizado pueda consultar/exportar y que otra cuenta de Google no pueda leer. No difundas enlaces hasta completar estas pruebas y contar con las autorizaciones institucionales.

## Alcance y seguridad

- La cédula permite identificar un registro para análisis, pero por sí sola NO verifica la identidad del participante. Para verificación real contra el padrón UTET se requiere un servicio seguro o autenticación institucional adicional.
- La app pública NO consulta los documentos de la colección Estudiante ni expone datos del respaldo privado suministrado.
- El participante selecciona su carrera a partir de una lista institucional sin información personal.
- Los resultados se almacenan solo en doctorado_respuestas; no se modifica ninguna colección del sistema UTET.
- El ID de cada encuesta es determinista por etapa y cédula: una segunda escritura no puede reemplazar el primer envío. Esto no impide que alguien con una cédula ajena intente enviar una respuesta falsa. Para uso amplio conviene añadir App Check, controles antiabuso y verificación segura de identidad.
- El CSV de administración contiene la cédula. Protege los archivos exportados y no los subas a repositorios públicos.
- Las respuestas son identificables o seudonimizables, NO completamente anónimas.
- Se requiere consentimiento voluntario, validación/pilotaje del instrumento, protocolo de investigación, definición de conservación de datos y aprobación institucional antes de la recolección formal.
- La encuesta mide principalmente experiencias, necesidades y competencias autopercibidas; no sustituye la evaluación independiente de la calidad científica de los artículos.

## Estructura de archivos

- index.html: entrada y rutas compatibles con GitHub Pages.
- assets/styles.css y assets/favicon.svg: interfaz responsive.
- src/questions.js: instrumentos de inicio, desarrollo y finalizados (10 preguntas por etapa).
- src/catalog.js: nombres institucionales de carreras, sin datos personales.
- src/app.js: pantalla inicial, consentimiento, navegación y envío.
- src/firebase.js: integración con Auth y Firestore, sin lectura del padrón institucional.
- src/admin.js: acceso con Google, métricas, filtros, detalle y exportación CSV.
- firestore.reglas-insertar.txt: reglas para insertar de forma aditiva, NO despliegue automático.
- .github/workflows/pages.yml: publicación a GitHub Pages con configuración en GitHub Secret.

## Análisis científico

La encuesta de inicio aborda preparación y expectativas. Desarrollo mide formación, dificultades y orientación. Finalizados aborda aprendizajes, resultados percibidos y oportunidades de mejora. Algunas preguntas se mantienen equivalentes para comparar etapas. Los resultados no demuestran por sí mismos causalidad ni progreso individual; para eso es necesario seguimiento longitudinal y evaluación externa de los artículos.

El CSV exporta etapa, carrera, fecha, preguntas p1–p10 y cinco competencias normalizadas para análisis estadístico.

## Estado operativo

El código está en main y el despliegue está preparado. El administrador no podrá acceder a los resultados y los estudiantes no podrán enviar hasta que se configuren Firebase/Auth/Rules/Pages con los permisos correspondientes. Estas operaciones no se ejecutan automáticamente desde el repositorio para evitar alterar la seguridad de otras aplicaciones de UTET.
