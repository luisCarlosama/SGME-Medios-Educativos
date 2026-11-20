# Conexion a la base institucional

La base actual sigue usando las variables `DB_*`. La conexion institucional es
independiente y solo se crea cuando se necesita; no modifica ni importa datos.

Configura estas variables en `backend/.env`, sin incluir credenciales en el
repositorio ni compartirlas por chat:

```env
INSTITUCIONAL_DB_HOST=servidor
INSTITUCIONAL_DB_PORT=5432
INSTITUCIONAL_DB_NAME=base_de_pruebas
INSTITUCIONAL_DB_USER=usuario_de_solo_lectura
INSTITUCIONAL_DB_PASSWORD=contraseña
INSTITUCIONAL_DB_SCHEMA=public
INSTITUCIONAL_DB_SSL=true
INSTITUCIONAL_PREVIEW_LOCAL=false
```

Solicita a Desarrollo de Software un usuario con permisos de lectura solo sobre
`vista_info_graduandos` y `vista_informacion_estudiantes`, y confirma el esquema
y los requisitos de conexion. Usa `INSTITUCIONAL_DB_SSL=false` solo si el
servidor de pruebas no utiliza SSL. Con SSL activado se verifica el certificado.

Desde la carpeta `backend`, ejecuta:

```sh
npm run verificar:vistas-institucionales
```

El comando comprueba el acceso y muestra los nombres de las columnas de ambas
vistas sin consultar registros de estudiantes. La importacion de graduandos
todavia no esta conectada a estas vistas: antes deben confirmarse las columnas,
las relaciones y los estados que habilitan a un aspirante para graduarse.

La ruta de vista previa del backend permanece disponible para desarrollo local,
pero ya no tiene un boton en la pantalla de graduandos. Para habilitarla,
configura `INSTITUCIONAL_PREVIEW_LOCAL=true` y reinicia el backend. Esta ruta
solo acepta conexiones locales y esta desactivada cuando `NODE_ENV=production`.
No se debe habilitar en servidores compartidos ni exponer detras de un proxy;
el proyecto aun no tiene autorizacion de servidor para esta ruta.

## Flujo de grado con datos ficticios

La migracion `migrations/007_periodo_y_procesos_grado.sql` agrega el periodo a
la tabla heredada de ceremonias y crea las tablas auxiliares del catalogo y de
sincronizacion. No modifica la base institucional. Las ceremonias anteriores
conservan la finalizacion manual; las nuevas se finalizan cuando termine la
ultima sesion, siempre que la ceremonia este en curso.

Las sesiones configuradas cambian automaticamente segun su horario solo
mientras la ceremonia esta en curso. Para iniciar la ceremonia debe existir
al menos un invitado registrado en ella, no uno por cada graduando o sesion.
Al iniciar la ceremonia se actualizan de
inmediato las sesiones cuyo horario ya comenzo; si ya termino, se marcan como
finalizadas. El proceso automatico revisa los horarios cada minuto. El modo
manual de una sesion conserva el estado elegido hasta que se cambie de nuevo
o se reactive el modo automatico. El detalle actualiza los estados mostrados
periodicamente. Para habilitar este comportamiento, aplica la migracion
`migrations/008_sesion_estado_manual.sql` a la base de la aplicacion antes
de desplegar el backend.

La consulta y actualizacion de procesos reales **no estan conectadas**. Los
botones de candidatos ficticios y administracion solo funcionan en desarrollo
local con dos bases PostgreSQL diferentes y aisladas:

* Una base de aplicacion local llamada `sgme_app_prueba_<sufijo>`, con el
  esquema heredado de la aplicacion, la migracion 007 y catalogos de prueba.
* Una base de procesos local distinta llamada `sgme_grados_prueba_<sufijo>`.

Ambas bases deben prepararse previamente; no copies datos reales a ellas.
En `backend/.env`, configura `DB_HOST`, `DB_NAME` y las demas variables `DB_*`
para la base de aplicacion aislada, y agrega:

```env
GRADO_PRUEBA_HABILITADA=true
GRADO_PRUEBA_DB_HOST=localhost
GRADO_PRUEBA_DB_PORT=5432
GRADO_PRUEBA_DB_NAME=sgme_grados_prueba_local
GRADO_PRUEBA_DB_USER=usuario_local
GRADO_PRUEBA_DB_PASSWORD=contrasena_local
```

No guardes contrasenas en el repositorio ni las compartas por chat. Ejecuta
desde `backend`:

```powershell
npm run crear:procesos-grado-prueba
```

El script crea tres procesos marcados con `es_prueba`; no modifica la base
institucional. El catalogo de estados elegibles se administra desde el listado
de ceremonias mediante «Administrar procesos ficticios». Desde la lista de
graduandos de una ceremonia se pueden consultar y agregar los candidatos
ficticios del periodo, asignando manualmente un programa de prueba.

Al finalizar una ceremonia, solo se solicita la actualizacion de los procesos
ficticios vinculados cuyo ingreso se registro. Los fallos quedan registrados
para reintento automatico o manual desde «Administrar procesos ficticios».
Para eliminar los procesos generados y sus graduandos, invitados y controles
asociados en la base aislada, ejecuta:

```powershell
npm run eliminar:procesos-grado-prueba
```

La limpieza solo acepta bases locales con los nombres indicados y afecta los
identificadores ficticios creados por el script. No elimina las ceremonias ni
las bases de datos. Para la conexion real se deben confirmar el identificador
de cada proceso, los estados y el mecanismo de escritura autorizado.

## Programas en sesiones de una ceremonia

Un programa academico solo puede estar asignado a una sesion de la misma
ceremonia; puede utilizarse de nuevo en otras ceremonias. Para trasladarlo,
primero debe retirarse de la sesion anterior, siempre que no tenga graduandos
asignados de ese programa. Las asignaciones duplicadas existentes deben
corregirse antes de guardar las sesiones afectadas.

## Fotografias de una ceremonia

Se pueden guardar hasta cuatro fotografias. Cada imagen guardada puede
eliminarse desde el registro fotografico, previa confirmacion; el espacio
liberado queda disponible para subir otra. Si la imagen cambio desde que se
abrio la pagina, hay que actualizarla antes de intentar eliminarla.

## Autorizacion de invitados

Los invitados nuevos quedan autorizados automaticamente al registrarse, siempre
que no se supere el limite por graduando. El estado de ingreso sigue siendo
independiente. La migracion `migrations/009_autorizar_invitados_ceremonias_activas.sql`
autoriza los registros pendientes de ceremonias programadas o en curso, sin
modificar los de ceremonias finalizadas o canceladas. Los registros antiguos
que permanezcan sin autorizacion no pueden ingresar y se indican para revision.
