import pool from '../db.js';

const INTERVALO_MS = 60_000;
let intervalo = null;
let actualizacionEnCurso = false;

async function actualizarEstadosPorHorario() {
  if (actualizacionEnCurso) return;
  actualizacionEnCurso = true;

  try {
    const resultado = await pool.query(
      `UPDATE public.sesion s
       SET estado = CASE
         WHEN c.fecha + s.hora_fin <= LOCALTIMESTAMP THEN 'Finalizada'
         ELSE 'En curso'
       END
       FROM public.ceremonia_grado c
       WHERE c.id_ceremonia = s.id_ceremonia
         AND c.estado <> 'Cancelada'
         AND s.estado IN ('Programada', 'En curso')
         AND s.hora_inicio IS NOT NULL
         AND s.hora_fin IS NOT NULL
         AND s.hora_fin > s.hora_inicio
         AND (
           (s.estado = 'Programada' AND c.fecha + s.hora_inicio <= LOCALTIMESTAMP)
           OR (s.estado = 'En curso' AND c.fecha + s.hora_fin <= LOCALTIMESTAMP)
         )
       RETURNING s.id_sesion`,
    );

    if (resultado.rowCount > 0) {
      console.info(`Se actualizaron automáticamente ${resultado.rowCount} estados de sesión.`);
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
