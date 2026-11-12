import { obtenerPoolProcesosPrueba } from './src/dbProcesosPrueba.js';
import appPool from './src/db.js';

let pool;
let client;
let transaccion = false;
try {
  if (!['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
      || !/^sgme_app_prueba_[a-z0-9_]+$/.test(process.env.DB_NAME || '')) {
    throw new Error('La limpieza requiere una base de aplicación local y aislada de pruebas.');
  }
  const ids = ['ficticio-pregrado-1', 'ficticio-posgrado-1', 'ficticio-pregrado-2'];
  pool = obtenerPoolProcesosPrueba();
  client = await appPool.connect();
  await client.query('BEGIN');
  transaccion = true;
  const vinculados = await client.query(
    `SELECT id_graduando FROM public.proceso_grado_ceremonia
     WHERE origen = 'prueba' AND id_proceso = ANY($1::text[]) FOR UPDATE`,
    [ids],
  );
  const graduandos = vinculados.rows.map((fila) => fila.id_graduando);
  if (graduandos.length > 0) {
    await client.query(
      `DELETE FROM public.control_ingreso
       WHERE id_graduando = ANY($1::integer[]) OR id_invitado IN
         (SELECT id_invitado FROM public.invitado WHERE id_graduando = ANY($1::integer[]))`,
      [graduandos],
    );
    await client.query('DELETE FROM public.invitado WHERE id_graduando = ANY($1::integer[])', [graduandos]);
    await client.query('DELETE FROM public.graduando_programa WHERE id_graduando = ANY($1::integer[])', [graduandos]);
    await client.query('DELETE FROM public.proceso_grado_ceremonia WHERE id_graduando = ANY($1::integer[])', [graduandos]);
    await client.query('DELETE FROM public.graduando WHERE id_graduando = ANY($1::integer[])', [graduandos]);
  }
  await client.query('COMMIT');
  transaccion = false;
  const resultado = await pool.query(
    `DELETE FROM public.proceso_grado_prueba
     WHERE es_prueba = TRUE AND id_proceso = ANY($1::text[])`,
    [ids],
  );
  console.log(`Se eliminaron ${resultado.rowCount} procesos ficticios y ${graduandos.length} registros vinculados de la aplicación de prueba.`);
} catch (error) {
  if (transaccion) await client.query('ROLLBACK');
  console.error('No fue posible eliminar los procesos ficticios:', error.message);
  process.exitCode = 1;
} finally {
  client?.release();
  await appPool.end();
  if (pool) await pool.end();
}
