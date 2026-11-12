import pool from '../db.js';
import { actualizarSesionesPorHorario } from './estadoSesiones.js';
import { prepararSincronizacionGrados, sincronizarGradosPrueba } from './sincronizacionGradosPrueba.js';

const INTERVALO_MS = 60_000;
let intervalo = null;
let actualizacionEnCurso = false;

export async function actualizarEstadosPorHorario() {
  if (actualizacionEnCurso) return;
  actualizacionEnCurso = true;

  try {
    const ceremonias = await pool.query(
      `SELECT id_ceremonia::text AS id
       FROM public.ceremonia_grado
       WHERE estado = 'En curso'
       ORDER BY id_ceremonia`,
    );
    for (const ceremonia of ceremonias.rows) {
      let client;
      let transaccion = false;
      try {
        client = await pool.connect();
        await client.query('BEGIN');
        transaccion = true;
        const bloqueada = await client.query(
          `SELECT 1 FROM public.ceremonia_grado
           WHERE id_ceremonia = $1 AND estado = 'En curso'
           FOR UPDATE`,
          [ceremonia.id],
        );
        if (bloqueada.rowCount > 0) {
          const resultado = await actualizarSesionesPorHorario(client, ceremonia.id);
          if (resultado.rowCount > 0) {
            console.info(`Se actualizaron automáticamente ${resultado.rowCount} estados de sesión.`);
          }
          const finalizadas = await client.query(
            `UPDATE public.ceremonia_grado c SET estado = 'Finalizada'
             WHERE c.id_ceremonia = $1 AND c.estado = 'En curso' AND c.finalizar_automaticamente = TRUE
               AND EXISTS (SELECT 1 FROM public.sesion s WHERE s.id_ceremonia = c.id_ceremonia)
               AND NOT EXISTS (
                 SELECT 1 FROM public.sesion s WHERE s.id_ceremonia = c.id_ceremonia
                   AND (s.estado <> 'Finalizada' OR s.hora_inicio IS NULL OR s.hora_fin IS NULL
                        OR s.hora_inicio >= s.hora_fin OR c.fecha + s.hora_fin > LOCALTIMESTAMP)
               )
             RETURNING c.id_ceremonia`,
            [ceremonia.id],
          );
          if (finalizadas.rowCount > 0) await prepararSincronizacionGrados(client, ceremonia.id);
        }
        await client.query('COMMIT');
        transaccion = false;
      } catch (error) {
        if (transaccion) await client.query('ROLLBACK');
        console.error(`No fue posible actualizar la ceremonia ${ceremonia.id}:`, error);
      } finally {
        client?.release();
      }
    }
    if (process.env.NODE_ENV !== 'production' && process.env.GRADO_PRUEBA_HABILITADA === 'true'
        && ['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
        && /^sgme_app_prueba_[a-z0-9_]+$/.test(process.env.DB_NAME || '')) {
      const sincronizacion = await sincronizarGradosPrueba();
      if (sincronizacion.errores) {
        console.error(`Hay ${sincronizacion.errores} procesos ficticios pendientes de sincronización.`);
      }
    }
  } catch (error) {
    console.error('No fue posible actualizar automáticamente los estados de sesión:', error);
  } finally {
    actualizacionEnCurso = false;
  }
}

export function iniciarAutomatizacionEstadosSesiones() {
  if (intervalo) return;
  intervalo = setInterval(() => {
    void actualizarEstadosPorHorario();
  }, INTERVALO_MS);
  intervalo.unref();
  void actualizarEstadosPorHorario();
}
