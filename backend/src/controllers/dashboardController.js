
import pool from '../db.js';

export const obtenerDashboard = async (req, res) => {
  try {
    const consultas = await Promise.all([
      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM solicitud_reserva
        WHERE estado = 'Pendiente'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM solicitud_reserva sr
        INNER JOIN solicitante s
          ON s.id_solicitante = sr.id_solicitante
        WHERE LOWER(s.tipo_solicitante) = 'externo'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM solicitud_reserva sr
        INNER JOIN solicitante s
          ON s.id_solicitante = sr.id_solicitante
        WHERE LOWER(s.tipo_solicitante) = 'interno'
      `),

      pool.query(`
        SELECT COUNT(*)::int AS total
        FROM solicitud_reserva sr
        WHERE sr.estado = 'Aprobada'
          AND CURRENT_DATE BETWEEN sr.fecha_inicio AND sr.fecha_fin
      `),

      pool.query(`
        SELECT
          sr.id_solicitud,
          sr.codigo_solicitud,
          s.nombre AS solicitante,
          e.nombre AS espacio,
          c.nombre AS campus,
          s.tipo_solicitante,
          sr.fecha_inicio,
          sr.estado
        FROM solicitud_reserva sr
        INNER JOIN solicitante s
          ON s.id_solicitante = sr.id_solicitante
        INNER JOIN espacio e
          ON e.id_espacio = sr.id_espacio
        INNER JOIN campus c
          ON c.id_campus = e.id_campus
        ORDER BY sr.fecha_registro DESC
        LIMIT 5
      `),
    ]);

    return res.json({
      stats: {
        solicitudesPendientes: consultas[0].rows[0].total,
        solicitudesExternas: consultas[1].rows[0].total,
        solicitudesInternas: consultas[2].rows[0].total,
        reservasHoy: consultas[3].rows[0].total,
      },
      solicitudesRecientes: consultas[4].rows.map((fila) => ({
        id: String(fila.id_solicitud),
        codigo: fila.codigo_solicitud,
        solicitante: fila.solicitante,
        espacio: fila.espacio,
        campus: fila.campus,
        tipoSolicitud:
          fila.tipo_solicitante.toLowerCase() === 'interno'
            ? 'Interna'
            : 'Externa',
        fecha: fila.fecha_inicio,
        estado: fila.estado,
      })),
    });
  } catch (error) {
    console.error('Error al consultar el dashboard:', error);

    return res.status(500).json({
      mensaje: 'No se pudo cargar el dashboard.',
    });
  }
};
