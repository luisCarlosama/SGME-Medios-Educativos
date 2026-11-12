import pool from '../db.js';
import { obtenerPoolProcesosPrueba } from '../dbProcesosPrueba.js';

export async function prepararSincronizacionGrados(executor, ceremoniaId) {
  await executor.query(
    `UPDATE public.proceso_grado_ceremonia p
     SET estado_sincronizacion = 'Pendiente', error_sincronizacion = NULL
     FROM public.graduando g
     WHERE p.id_graduando = g.id_graduando
       AND g.id_ceremonia = $1 AND p.estado_sincronizacion = 'Sin solicitar'
       AND EXISTS (
         SELECT 1 FROM public.control_ingreso ci
         INNER JOIN public.sesion s ON s.id_sesion = ci.id_sesion
         WHERE ci.id_graduando = g.id_graduando AND ci.ingreso = TRUE
           AND s.id_ceremonia = g.id_ceremonia
       )`,
    [ceremoniaId],
  );
}

export async function sincronizarGradosPrueba() {
  if (process.env.NODE_ENV === 'production' || process.env.GRADO_PRUEBA_HABILITADA !== 'true'
      || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
      || !/^sgme_app_prueba_[a-z0-9_]+$/.test(process.env.DB_NAME || '')) {
    throw new Error('La sincronización ficticia solo está disponible en el entorno de pruebas aislado.');
  }
  const pendientes = await pool.query(
    `SELECT id_graduando FROM public.proceso_grado_ceremonia
     WHERE origen = 'prueba' AND estado_sincronizacion IN ('Pendiente', 'Error')
     ORDER BY id_graduando`,
  );
  let actualizados = 0;
  let errores = 0;
  for (const pendiente of pendientes.rows) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const actual = await client.query(
        `SELECT id_proceso FROM public.proceso_grado_ceremonia
         WHERE id_graduando = $1 AND origen = 'prueba'
           AND estado_sincronizacion IN ('Pendiente', 'Error') FOR UPDATE`,
        [pendiente.id_graduando],
      );
      if (!actual.rowCount) {
        await client.query('COMMIT');
        continue;
      }
      try {
        const resultado = await obtenerPoolProcesosPrueba().query(
          `UPDATE public.proceso_grado_prueba SET estado = 'Titulado'
           WHERE id_proceso = $1 AND es_prueba = TRUE`,
          [actual.rows[0].id_proceso],
        );
        if (resultado.rowCount !== 1) throw new Error('El proceso ficticio no existe.');
        await client.query(
          `UPDATE public.proceso_grado_ceremonia
           SET estado_sincronizacion = 'Sincronizado', error_sincronizacion = NULL
           WHERE id_graduando = $1`,
          [pendiente.id_graduando],
        );
        actualizados += 1;
      } catch (error) {
        console.error('Error al sincronizar proceso ficticio:', error.message);
        await client.query(
          `UPDATE public.proceso_grado_ceremonia
           SET estado_sincronizacion = 'Error', error_sincronizacion = $2
           WHERE id_graduando = $1`,
          [pendiente.id_graduando, error.message.slice(0, 500)],
        );
        errores += 1;
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  return { actualizados, errores };
}
