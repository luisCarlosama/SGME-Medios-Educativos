
import pool from '../db.js';
import { randomUUID } from 'node:crypto';

// Obtener campus
export const obtenerCampus = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id_campus, nombre, direccion_sede
      FROM campus
      ORDER BY nombre
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar campus:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar los campus.',
    });
  }
};

// Obtener tipos de espacio
export const obtenerTiposEspacio = async (req, res) => {
  try {
    const resultado = await pool.query(`
      SELECT id_tipo_espacio, nombre
      FROM tipo_espacio
      ORDER BY nombre
    `);

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar tipos de espacio:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar los tipos de espacio.',
    });
  }
};

// Obtener espacios activos filtrados por campus y tipo
export const obtenerEspacios = async (req, res) => {
  try {
    const { id_campus, id_tipo_espacio, solo_auditorios } = req.query;

    const condiciones = ['e.estado = TRUE'];
    const valores = [];

    if (id_campus) {
      valores.push(Number(id_campus));
      condiciones.push(`e.id_campus = $${valores.length}`);
    }

    if (id_tipo_espacio) {
      valores.push(Number(id_tipo_espacio));
      condiciones.push(`e.id_tipo_espacio = $${valores.length}`);
    }

    if (solo_auditorios === 'true') {
      condiciones.push("e.nombre ILIKE '%auditorio%'");
    }

    const resultado = await pool.query(
      `
        SELECT
          e.id_espacio,
          e.nombre,
          e.id_campus,
          e.id_tipo_espacio,
          e.capacidad,
          e.ubicacion,
          e.recursos,
          e.recursos_otro,
          e.descripcion,
          c.nombre AS campus,
          te.nombre AS tipo_espacio
        FROM espacio e
        INNER JOIN campus c
          ON c.id_campus = e.id_campus
        INNER JOIN tipo_espacio te
          ON te.id_tipo_espacio = e.id_tipo_espacio
        WHERE ${condiciones.join(' AND ')}
        ORDER BY c.nombre, e.nombre
      `,
      valores
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar espacios:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar los espacios.',
    });
  }
};

// Obtener catálogos institucionales
export const obtenerCatalogosInstitucionales = async (req, res) => {
  try {
    const consultas = await Promise.all([
      pool.query(`
        SELECT id_dependencia, nombre
        FROM dependencia
        WHERE estado = TRUE
        ORDER BY nombre
      `),
      pool.query(`
        SELECT id_programa, nombre
        FROM programa
        WHERE estado = TRUE
        ORDER BY nombre
      `),
      pool.query(`
        SELECT id_area, nombre
        FROM area
        WHERE estado = TRUE
        ORDER BY nombre
      `),
      pool.query(`
      SELECT id_departamento, nombre
      FROM departamento
      WHERE estado = TRUE
       ORDER BY nombre
      `),
    ]);

    return res.json({
      dependencias: consultas[0].rows,
      programas: consultas[1].rows,
      areas: consultas[2].rows,
      departamentos: consultas[3].rows,
    });
  } catch (error) {
    console.error('Error al consultar catálogos institucionales:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar los catálogos institucionales.',
    });
  }
};

// Consultar disponibilidad de un espacio
export const consultarDisponibilidad = async (req, res) => {
  try {
    const { id_espacio, fecha, hora_inicio, hora_fin } = req.query;

    if (!id_espacio || !fecha || !hora_inicio || !hora_fin) {
      return res.status(400).json({
        mensaje:
          'Debes indicar el espacio, la fecha, la hora de inicio y la hora de finalización.',
      });
    }

    const idEspacio = Number(id_espacio);

    if (!Number.isInteger(idEspacio) || idEspacio <= 0) {
      return res.status(400).json({
        mensaje: 'El espacio seleccionado no es válido.',
      });
    }

    if (hora_fin <= hora_inicio) {
      return res.status(400).json({
        mensaje: 'La hora final debe ser posterior a la hora inicial.',
      });
    }

    const espacio = await pool.query(
      `
        SELECT id_espacio
        FROM espacio
        WHERE id_espacio = $1
          AND estado = TRUE
      `,
      [idEspacio]
    );

    if (espacio.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'El espacio no existe o está inactivo.',
      });
    }

    const resultado = await pool.query(
      `
        SELECT EXISTS (
          SELECT 1
          FROM solicitud_reserva sr
          WHERE sr.id_espacio = $1
            AND sr.estado = 'Aprobada'
            AND sr.es_recurrente = FALSE
            AND sr.fecha_inicio <= $2::date
            AND sr.fecha_fin >= $2::date
            AND sr.hora_inicio < $4::time
            AND sr.hora_fin > $3::time
        )
        OR EXISTS (
          SELECT 1
          FROM solicitud_reserva sr
          INNER JOIN solicitud_reserva_ocurrencia o
            ON o.id_solicitud = sr.id_solicitud
          WHERE sr.id_espacio = $1
            AND sr.estado = 'Aprobada'
            AND sr.es_recurrente = TRUE
            AND o.fecha_inicio <= $2::date
            AND o.fecha_fin >= $2::date
            AND o.hora_inicio < $4::time
            AND o.hora_fin > $3::time
        ) AS ocupado
      `,
      [idEspacio, fecha, hora_inicio, hora_fin]
    );

    return res.json({
      disponible: !resultado.rows[0].ocupado,
      id_espacio: idEspacio,
      fecha,
      hora_inicio,
      hora_fin,
    });
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    return res.status(500).json({
      mensaje: 'No se pudo consultar la disponibilidad del espacio.',
    });
  }
};

// Consultar agenda real de un espacio para una fecha
export const obtenerAgendaDia = async (req, res) => {
  try {
    const { id_espacio, fecha } = req.query;

    const idEspacio = Number(id_espacio);

    if (
      !id_espacio ||
      !Number.isInteger(idEspacio) ||
      idEspacio <= 0 ||
      !fecha ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
      return res.status(400).json({
        mensaje: 'Debes indicar un espacio y una fecha válidos.',
      });
    }

    const espacio = await pool.query(
      `SELECT id_espacio
       FROM espacio
       WHERE id_espacio = $1
         AND estado = TRUE`,
      [idEspacio]
    );

    if (espacio.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'El espacio no existe o está inactivo.',
      });
    }

    const resultado = await pool.query(
      `
      SELECT
        sr.id_solicitud,
        sr.codigo_solicitud,
        sr.nombre_actividad,
        sr.fecha_inicio,
        sr.fecha_fin,
        sr.hora_inicio,
        sr.hora_fin,
        sr.es_recurrente
      FROM solicitud_reserva sr
      WHERE sr.id_espacio = $1
        AND sr.estado = 'Aprobada'
        AND COALESCE(sr.es_recurrente, FALSE) = FALSE
        AND sr.fecha_inicio <= $2::date
        AND sr.fecha_fin >= $2::date

      UNION ALL

      SELECT
        sr.id_solicitud,
        sr.codigo_solicitud,
        sr.nombre_actividad,
        o.fecha_inicio,
        o.fecha_fin,
        o.hora_inicio,
        o.hora_fin,
        sr.es_recurrente
      FROM solicitud_reserva sr
      INNER JOIN solicitud_reserva_ocurrencia o
        ON o.id_solicitud = sr.id_solicitud
      WHERE sr.id_espacio = $1
        AND sr.estado = 'Aprobada'
        AND sr.es_recurrente = TRUE
        AND o.fecha_inicio <= $2::date
        AND o.fecha_fin >= $2::date

      ORDER BY hora_inicio
      `,
      [idEspacio, fecha]
    );

    return res.json({
      id_espacio: idEspacio,
      fecha,
      reservas: resultado.rows,
    });
  } catch (error) {
    console.error('Error al consultar agenda del día:', error);

    return res.status(500).json({
      mensaje: 'No se pudo consultar la agenda del espacio.',
    });
  }
};

// Registrar una solicitud de reserva
export const crearSolicitud = async (req, res) => {
  const {
    tipo_solicitante,
    nombre,
    cargo,
    correo,
    numero_contacto,
    identificacion,
    nombre_entidad,
    tipo_entidad,
    ciudad,
    id_programa,
    id_dependencia,
    id_area,
    id_departamento,
    id_espacio,
    fecha_inicio,
    fecha_fin,
    hora_inicio,
    hora_fin,
    nombre_actividad,
    medios_requeridos,
    observaciones,
    frecuencia_recurrencia = null,
    dias_semana = null,
    ocurrencias = [],
  } = req.body;

  const tipo = String(tipo_solicitante || '').trim().toLowerCase();

  let es_recurrente = Boolean(req.body.es_recurrente);

  if (!['interno', 'externo'].includes(tipo)) {
    return res.status(400).json({
      mensaje: 'El tipo de solicitante debe ser interno o externo.',
    });
  }

  // Validar fechas según el tipo de solicitante
  const esRangoFechas = fecha_inicio !== fecha_fin;

  // Los externos solo pueden solicitar reservas de un día
  if (tipo === 'externo' && esRangoFechas) {
    return res.status(400).json({
      mensaje: 'Los solicitantes externos solo pueden reservar para un día.',
    });
  }

  // Los externos no pueden realizar solicitudes recurrentes
  if (tipo === 'externo' && es_recurrente) {
    return res.status(400).json({
      mensaje: 'Los solicitantes externos no pueden realizar reservas recurrentes.',
    });
  }

  // Una recurrencia interna necesita un rango de fechas
  if (tipo === 'interno' && es_recurrente && !esRangoFechas) {
    return res.status(400).json({
      mensaje: 'Para realizar una reserva recurrente debes seleccionar una fecha inicial y una fecha final diferentes.',
    });
  }

  // Un rango de fechas interno implica recurrencia automática
  if (tipo === 'interno' && esRangoFechas) {
    es_recurrente = true;
  }

  if (
    !nombre?.trim() ||
    !id_espacio ||
    !fecha_inicio ||
    !fecha_fin ||
    !hora_inicio ||
    !hora_fin ||
    !nombre_actividad?.trim()
  ) {
    return res.status(400).json({
      mensaje: 'Completa los campos obligatorios de la solicitud.',
    });
  }

  if (fecha_fin < fecha_inicio || hora_fin <= hora_inicio) {
    return res.status(400).json({
      mensaje: 'Las fechas o el horario de la reserva no son válidos.',
    });
  }

  if (tipo === 'interno') {
    if (
      !correo?.trim() ||
      !correo.trim().toLowerCase().endsWith('@unicesmag.edu.co')
    ) {
      return res.status(400).json({
        mensaje: 'El correo institucional debe terminar en @unicesmag.edu.co.',
      });
    }
  }

  if (tipo === 'externo' && !identificacion?.trim()) {
    return res.status(400).json({
      mensaje: 'La identificación es obligatoria para solicitantes externos.',
    });
  }

  if (es_recurrente) {
    if (!Array.isArray(ocurrencias) || ocurrencias.length === 0) {
      return res.status(400).json({
        mensaje: 'Debes enviar las fechas de las ocurrencias recurrentes.',
      });
    }

    if (!['diaria', 'semanal', 'mensual'].includes(frecuencia_recurrencia)) {
      return res.status(400).json({
        mensaje: 'La frecuencia de recurrencia no es válida.',
      });
    }

    if (
      frecuencia_recurrencia === 'semanal' &&
      (!Array.isArray(dias_semana) ||
        dias_semana.length === 0 ||
        dias_semana.some(
          (dia) => !Number.isInteger(Number(dia)) ||
            Number(dia) < 1 ||
            Number(dia) > 7
        ))
    ) {
      return res.status(400).json({
        mensaje: 'Selecciona los días de la semana de la recurrencia.',
      });
    }
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    const espacio = await cliente.query(
      `
        SELECT id_espacio
        FROM espacio
        WHERE id_espacio = $1
          AND estado = TRUE
      `,
      [Number(id_espacio)]
    );

    if (espacio.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(400).json({
        mensaje: 'El espacio seleccionado no existe o no está disponible.',
      });
    }


    let idSolicitante;

    if (tipo === 'interno') {
      const existente = await cliente.query(
        `
    SELECT id_solicitante
    FROM solicitante
    WHERE LOWER(TRIM(correo)) = LOWER(TRIM($1))
      AND LOWER(TRIM(tipo_solicitante)) = LOWER(TRIM($2))
    LIMIT 1
  `,
        [correo.trim(), tipo]
      );

      if (existente.rowCount > 0) {
        idSolicitante = existente.rows[0].id_solicitante;
      }
    }

    if (!idSolicitante) {
      const solicitanteResult = await cliente.query(
        `
      INSERT INTO solicitante (
        nombre,
        cargo,
        correo,
        numero_contacto,
        tipo_solicitante,
        identificacion,
        nombre_entidad,
        tipo_entidad,
        ciudad,
        id_programa,
        id_dependencia,
        id_area,
        id_departamento
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
      )
      RETURNING id_solicitante
    `,
        [
          nombre.trim(),
          cargo?.trim() || null,
          correo?.trim() || null,
          numero_contacto?.trim() || null,
          tipo,
          identificacion?.trim() || null,
          tipo === 'externo' ? nombre_entidad?.trim() || null : null,
          tipo === 'externo' ? tipo_entidad?.trim() || null : null,
          tipo === 'externo' ? ciudad?.trim() || null : null,
          tipo === 'interno' ? id_programa || null : null,
          tipo === 'interno' ? id_dependencia || null : null,
          tipo === 'interno' ? id_area || null : null,
          tipo === 'interno' ? id_departamento || null : null,
        ]
      );

      idSolicitante = solicitanteResult.rows[0].id_solicitante;
    }

    const codigo = `RES-${Date.now()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    const solicitudResult = await cliente.query(
      `
        INSERT INTO solicitud_reserva (
          id_solicitante,
          id_espacio,
          codigo_solicitud,
          fecha_inicio,
          fecha_fin,
          hora_inicio,
          hora_fin,
          nombre_actividad,
          estado,
          medios_requeridos,
          observaciones,
          es_recurrente,
          frecuencia_recurrencia,
          dias_semana
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 'Pendiente',
          $9, $10, $11, $12, $13
        )
        RETURNING id_solicitud, codigo_solicitud, estado
      `,
      [
        idSolicitante,
        Number(id_espacio),
        codigo,
        fecha_inicio,
        fecha_fin,
        hora_inicio,
        hora_fin,
        nombre_actividad.trim(),
        medios_requeridos || null,
        observaciones?.trim() || null,
        Boolean(es_recurrente),
        es_recurrente ? frecuencia_recurrencia : null,
        es_recurrente && frecuencia_recurrencia === 'semanal'
          ? dias_semana.map(Number)
          : null,
      ]
    );

    const solicitud = solicitudResult.rows[0];

    if (es_recurrente) {
      for (const ocurrencia of ocurrencias) {
        if (
          !ocurrencia.fecha_inicio ||
          !ocurrencia.fecha_fin ||
          !ocurrencia.hora_inicio ||
          !ocurrencia.hora_fin ||
          ocurrencia.fecha_fin < ocurrencia.fecha_inicio ||
          ocurrencia.hora_fin <= ocurrencia.hora_inicio
        ) {
          throw new Error(
            'Una de las ocurrencias tiene fechas u horarios inválidos.'
          );
        }

        await cliente.query(
          `
            INSERT INTO solicitud_reserva_ocurrencia (
              id_solicitud,
              fecha_inicio,
              fecha_fin,
              hora_inicio,
              hora_fin
            )
            VALUES ($1, $2, $3, $4, $5)
          `,
          [
            solicitud.id_solicitud,
            ocurrencia.fecha_inicio,
            ocurrencia.fecha_fin,
            ocurrencia.hora_inicio,
            ocurrencia.hora_fin,
          ]
        );
      }
    }

    await cliente.query('COMMIT');

    return res.status(201).json({
      mensaje: 'Solicitud registrada correctamente.',
      solicitud: {
        id: solicitud.id_solicitud,
        codigo: solicitud.codigo_solicitud,
        estado: solicitud.estado,
      },
    });
  } catch (error) {
    await cliente.query('ROLLBACK');

    console.error('Error al crear solicitud:', error);

    return res.status(500).json({
      mensaje: 'No se pudo registrar la solicitud.',
      detalle: error.message,
    });
  } finally {
    cliente.release();
  }
};

// Consultar una solicitud por su código
export const consultarSolicitudPorCodigo = async (req, res) => {
  try {
    const { codigo } = req.params;

    if (!codigo || !codigo.trim()) {
      return res.status(400).json({
        mensaje: 'Debes indicar el código de la solicitud.',
      });
    }

    const resultado = await pool.query(
      `
      SELECT
        sr.id_solicitud,
        sr.codigo_solicitud AS codigo,
        sr.estado,
        sr.fecha_inicio,
        sr.fecha_fin,
        sr.hora_inicio,
        sr.hora_fin,
        sr.nombre_actividad,
        sr.es_recurrente,
        sr.medios_requeridos,
        sr.observaciones,
        e.nombre AS espacio,
        s.nombre AS nombre_solicitante,
        s.correo,
        s.tipo_solicitante,
        (
          SELECT COUNT(*)
          FROM solicitud_reserva_ocurrencia o
          WHERE o.id_solicitud = sr.id_solicitud
        ) AS cantidad_ocurrencias
      FROM solicitud_reserva sr
      INNER JOIN espacio e
        ON e.id_espacio = sr.id_espacio
      INNER JOIN solicitante s
        ON s.id_solicitante = sr.id_solicitante
      WHERE UPPER(sr.codigo_solicitud) = UPPER($1)
      `,
      [codigo.trim()]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró ninguna solicitud con ese código.',
      });
    }

    const fila = resultado.rows[0];

    return res.json({
      codigo: fila.codigo,
      estado: fila.estado,
      espacio: fila.espacio,
      fecha_inicio: fila.fecha_inicio,
      fecha_fin: fila.fecha_fin,
      hora_inicio: fila.hora_inicio,
      hora_fin: fila.hora_fin,
      nombre_actividad: fila.nombre_actividad,
      nombre_solicitante: fila.nombre_solicitante,
      es_recurrente: fila.es_recurrente,
      cantidad_ocurrencias: Number(fila.cantidad_ocurrencias) || 0,
      medios_requeridos: fila.medios_requeridos,
      observaciones: fila.observaciones,
    });
  } catch (error) {
    console.error('Error al consultar solicitud por código:', error);
    return res.status(500).json({
      mensaje: 'No se pudo consultar la solicitud.',
    });
  }
};

// Obtener detalle completo de una solicitud por ID
export const obtenerSolicitudPorId = async (req, res) => {
  try {
    const { id } = req.params;
    const idSolicitud = Number(id);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la solicitud no es válido.',
      });
    }

    const resultado = await pool.query(
      `
      SELECT
        sr.id_solicitud,
        sr.codigo_solicitud,
        sr.estado,
        sr.fecha_registro,
        sr.fecha_actualizacion,
        sr.fecha_inicio,
        sr.fecha_fin,
        sr.hora_inicio,
        sr.hora_fin,
        sr.nombre_actividad,
        sr.medios_requeridos,
        sr.observaciones,
        sr.motivo_cancelacion,
        sr.es_recurrente,
        sr.frecuencia_recurrencia,
        sr.dias_semana,

        s.id_solicitante,
        s.nombre AS nombre_solicitante,
        s.cargo,
        s.correo,
        s.numero_contacto,
        s.tipo_solicitante,
        s.identificacion,
        s.nombre_entidad,
        s.tipo_entidad,
        s.ciudad,
        s.id_programa,
        s.id_dependencia,
        s.id_area,
        s.id_departamento,

        e.id_espacio,
        e.nombre AS espacio,
        e.capacidad,
        te.nombre AS tipo_espacio,
        c.nombre AS campus,

        p.nombre AS programa,
        d.nombre AS dependencia,
        a.nombre AS area,
        dep.nombre AS departamento

      FROM solicitud_reserva sr
      INNER JOIN solicitante s ON s.id_solicitante = sr.id_solicitante
      INNER JOIN espacio e ON e.id_espacio = sr.id_espacio
      INNER JOIN tipo_espacio te ON te.id_tipo_espacio = e.id_tipo_espacio
      INNER JOIN campus c ON c.id_campus = e.id_campus
      LEFT JOIN programa p ON p.id_programa = s.id_programa
      LEFT JOIN dependencia d ON d.id_dependencia = s.id_dependencia
      LEFT JOIN area a ON a.id_area = s.id_area
      LEFT JOIN departamento dep ON dep.id_departamento = s.id_departamento
      WHERE sr.id_solicitud = $1
      `,
      [idSolicitud]
    );

    if (resultado.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró la solicitud.',
      });
    }

    const fila = resultado.rows[0];

    // Obtener ocurrencias si es recurrente
    let ocurrencias = [];
    if (fila.es_recurrente) {
      const occ = await pool.query(
        `
        SELECT fecha_inicio, fecha_fin, hora_inicio, hora_fin
        FROM solicitud_reserva_ocurrencia
        WHERE id_solicitud = $1
        ORDER BY fecha_inicio
        `,
        [idSolicitud]
      );
      ocurrencias = occ.rows;
    }

    return res.json({
      id: fila.id_solicitud,
      codigo: fila.codigo_solicitud,
      estado: fila.estado,
      fecha_registro: fila.fecha_registro,
      fecha_actualizacion: fila.fecha_actualizacion,
      fecha_inicio: fila.fecha_inicio,
      fecha_fin: fila.fecha_fin,
      hora_inicio: fila.hora_inicio,
      hora_fin: fila.hora_fin,
      nombre_actividad: fila.nombre_actividad,
      medios_requeridos: fila.medios_requeridos,
      observaciones: fila.observaciones,
      motivo_cancelacion: fila.motivo_cancelacion,
      es_recurrente: fila.es_recurrente,
      frecuencia_recurrencia: fila.frecuencia_recurrencia,
      dias_semana: fila.dias_semana,
      ocurrencias,

      solicitante: {
        id: fila.id_solicitante,
        nombre: fila.nombre_solicitante,
        cargo: fila.cargo,
        correo: fila.correo,
        numero_contacto: fila.numero_contacto,
        tipo: fila.tipo_solicitante,
        identificacion: fila.identificacion,
        nombre_entidad: fila.nombre_entidad,
        tipo_entidad: fila.tipo_entidad,
        ciudad: fila.ciudad,
        programa: fila.programa,
        dependencia: fila.dependencia,
        area: fila.area,
        departamento: fila.departamento,
      },

      espacio: {
        id: fila.id_espacio,
        nombre: fila.espacio,
        tipo: fila.tipo_espacio,
        campus: fila.campus,
        capacidad: fila.capacidad,
      },
    });
  } catch (error) {
    console.error('Error al obtener solicitud por ID:', error);
    return res.status(500).json({
      mensaje: 'No se pudo obtener la solicitud.',
    });
  }
};

// Actualizar estado de una solicitud (Aprobar / Rechazar)
export const actualizarEstadoSolicitud = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, motivo_cancelacion } = req.body;

    const idSolicitud = Number(id);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la solicitud no es válido.',
      });
    }

    if (!['Aprobada', 'Rechazada', 'Cancelada'].includes(estado)) {
      return res.status(400).json({
        mensaje: 'El estado solo puede ser "Aprobada" o "Rechazada".',
      });
    }

    if (estado === 'Rechazada' && !motivo_cancelacion?.trim()) {
      return res.status(400).json({
        mensaje: 'Debes indicar el motivo del rechazo.',
      });
    }

    // Verificar que la solicitud exista y esté pendiente
    const actual = await pool.query(
      `
      SELECT id_solicitud, estado
      FROM solicitud_reserva
      WHERE id_solicitud = $1
      `,
      [idSolicitud]
    );

    if (actual.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró la solicitud.',
      });
    }

    if (actual.rows[0].estado !== 'Pendiente') {
      return res.status(400).json({
        mensaje: `La solicitud ya está en estado "${actual.rows[0].estado}" y no se puede modificar.`,
      });
    }

    const resultado = await pool.query(
      `
  UPDATE solicitud_reserva
  SET
    estado = $1,
    motivo_cancelacion = $2,
    fecha_actualizacion = NOW()
  WHERE id_solicitud = $3
  RETURNING id_solicitud, codigo_solicitud, estado, motivo_cancelacion, fecha_actualizacion
  `,
      [
        estado,
        (estado === 'Rechazada' || estado === 'Cancelada')
          ? motivo_cancelacion.trim()
          : null,
        idSolicitud,
      ]
    );

    return res.json({
      mensaje:
        estado === 'Aprobada'
          ? 'Solicitud aprobada correctamente.'
          : estado === 'Cancelada'
            ? 'Reserva cancelada correctamente.'
            : 'Solicitud rechazada correctamente.',
      solicitud: resultado.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar estado de la solicitud:', error);
    return res.status(500).json({
      mensaje: 'No se pudo actualizar el estado de la solicitud.',
    });
  }
};


// Actualizar una solicitud completa
export const actualizarSolicitud = async (req, res) => {
  const { id } = req.params;
  const idSolicitud = Number(id);

  if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
    return res.status(400).json({
      mensaje: 'El ID de la solicitud no es válido.',
    });
  }

  const {
    // Datos del evento
    fecha_inicio,
    fecha_fin,
    hora_inicio,
    hora_fin,
    nombre_actividad,
    medios_requeridos,
    observaciones,
    frecuencia_recurrencia = null,
    dias_semana = null,
    ocurrencias = [],

    // Datos del solicitante
    nombre,
    cargo,
    correo,
    numero_contacto,
    identificacion,
    nombre_entidad,
    tipo_entidad,
    ciudad,
    id_programa,
    id_dependencia,
    id_area,
    id_departamento,

    // Espacio
    id_espacio,
  } = req.body;

  // Validaciones básicas
  if (
    !nombre?.trim() ||
    !id_espacio ||
    !fecha_inicio ||
    !fecha_fin ||
    !hora_inicio ||
    !hora_fin ||
    !nombre_actividad?.trim()
  ) {
    return res.status(400).json({
      mensaje: 'Completa los campos obligatorios.',
    });
  }

  if (fecha_fin < fecha_inicio || hora_fin <= hora_inicio) {
    return res.status(400).json({
      mensaje: 'Las fechas o el horario no son válidos.',
    });
  }

  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');

    // 1. Verificar que la solicitud exista
    const actual = await cliente.query(
      `SELECT id_solicitud, id_solicitante, estado
       FROM solicitud_reserva
       WHERE id_solicitud = $1`,
      [idSolicitud]
    );

    if (actual.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'Solicitud no encontrada.' });
    }

    const idSolicitante = actual.rows[0].id_solicitante;

    // 2. Verificar que el espacio exista y esté activo
    const espacio = await cliente.query(
      `SELECT id_espacio FROM espacio WHERE id_espacio = $1 AND estado = TRUE`,
      [Number(id_espacio)]
    );

    if (espacio.rowCount === 0) {
      await cliente.query('ROLLBACK');
      return res.status(400).json({
        mensaje: 'El espacio seleccionado no existe o no está disponible.',
      });
    }

    // 3. Validar disponibilidad (excluyendo la propia solicitud)
    const conflicto = await cliente.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM solicitud_reserva sr
        WHERE sr.id_espacio = $1
          AND sr.id_solicitud <> $2
          AND sr.estado = 'Aprobada'
          AND sr.es_recurrente = FALSE
          AND sr.fecha_inicio <= $4::date
          AND sr.fecha_fin >= $3::date
          AND sr.hora_inicio < $6::time
          AND sr.hora_fin > $5::time
      )
      OR EXISTS (
        SELECT 1
        FROM solicitud_reserva sr
        INNER JOIN solicitud_reserva_ocurrencia o ON o.id_solicitud = sr.id_solicitud
        WHERE sr.id_espacio = $1
          AND sr.id_solicitud <> $2
          AND sr.estado = 'Aprobada'
          AND sr.es_recurrente = TRUE
          AND o.fecha_inicio <= $4::date
          AND o.fecha_fin >= $3::date
          AND o.hora_inicio < $6::time
          AND o.hora_fin > $5::time
      ) AS ocupado
      `,
      [
        Number(id_espacio),
        idSolicitud,
        fecha_inicio,
        fecha_fin,
        hora_inicio,
        hora_fin,
      ]
    );

    if (conflicto.rows[0].ocupado) {
      await cliente.query('ROLLBACK');
      return res.status(409).json({
        mensaje: 'El espacio no está disponible en las fechas y horarios seleccionados.',
      });
    }

    // 4. Actualizar datos del solicitante
    await cliente.query(
      `
      UPDATE solicitante SET
        nombre = $1,
        cargo = $2,
        correo = $3,
        numero_contacto = $4,
        identificacion = $5,
        nombre_entidad = $6,
        tipo_entidad = $7,
        ciudad = $8,
        id_programa = $9,
        id_dependencia = $10,
        id_area = $11,
        id_departamento  = $12
      WHERE id_solicitante = $13
      `,
      [
        nombre.trim(),
        cargo?.trim() || null,
        correo?.trim() || null,
        numero_contacto?.trim() || null,
        identificacion?.trim() || null,
        nombre_entidad?.trim() || null,
        tipo_entidad?.trim() || null,
        ciudad?.trim() || null,
        id_programa || null,
        id_dependencia || null,
        id_area || null,
        id_departamento || null,
        idSolicitante,
      ]
    );

    // 5. Actualizar la solicitud
    await cliente.query(
      `
      UPDATE solicitud_reserva SET
        id_espacio = $1,
        fecha_inicio = $2,
        fecha_fin = $3,
        hora_inicio = $4,
        hora_fin = $5,
        nombre_actividad = $6,
        medios_requeridos = $7,
        observaciones = $8,
        es_recurrente = $9,
        frecuencia_recurrencia = $10,
        dias_semana = $11,
        fecha_actualizacion = NOW()
      WHERE id_solicitud = $12
      `,
      [
        Number(id_espacio),
        fecha_inicio,
        fecha_fin,
        hora_inicio,
        hora_fin,
        nombre_actividad.trim(),
        medios_requeridos || null,
        observaciones?.trim() || null,
        Boolean(es_recurrente),
        es_recurrente ? frecuencia_recurrencia : null,
        es_recurrente && frecuencia_recurrencia === 'semanal'
          ? dias_semana
          : null,
        idSolicitud,
      ]
    );

    // 6. Manejar ocurrencias (borrar las viejas y crear las nuevas)
    await cliente.query(
      `DELETE FROM solicitud_reserva_ocurrencia WHERE id_solicitud = $1`,
      [idSolicitud]
    );

    if (es_recurrente && Array.isArray(ocurrencias) && ocurrencias.length > 0) {
      for (const occ of ocurrencias) {
        await cliente.query(
          `
          INSERT INTO solicitud_reserva_ocurrencia
            (id_solicitud, fecha_inicio, fecha_fin, hora_inicio, hora_fin)
          VALUES ($1, $2, $3, $4, $5)
          `,
          [
            idSolicitud,
            occ.fecha_inicio,
            occ.fecha_fin,
            occ.hora_inicio,
            occ.hora_fin,
          ]
        );
      }
    }

    await cliente.query('COMMIT');

    return res.json({
      mensaje: 'Solicitud actualizada correctamente.',
      id: idSolicitud,
    });
  } catch (error) {
    await cliente.query('ROLLBACK');
    console.error('Error al actualizar solicitud:', error);
    return res.status(500).json({
      mensaje: 'No se pudo actualizar la solicitud.',
      detalle: error.message,
    });
  } finally {
    cliente.release();
  }
};

// Listar todas las solicitudes (con filtros opcionales)
export const listarSolicitudes = async (req, res) => {
  try {
    const {
      busqueda,
      estado,
      campus,
      tipo,
      fecha,
      espacio,
    } = req.query;

    const condiciones = [];
    const valores = [];

    if (busqueda) {
      valores.push(`%${busqueda}%`);
      condiciones.push(`(
        sr.codigo_solicitud ILIKE $${valores.length}
        OR s.nombre ILIKE $${valores.length}
      )`);
    }

    if (estado) {
      valores.push(estado);
      condiciones.push(`sr.estado = $${valores.length}`);
    }

    if (tipo) {
      valores.push(tipo.toLowerCase());
      condiciones.push(`s.tipo_solicitante = $${valores.length}`);
    }

    if (fecha) {
      valores.push(fecha);
      condiciones.push(`sr.fecha_inicio = $${valores.length}`);
    }

    if (espacio) {
      valores.push(`%${espacio}%`);
      condiciones.push(`e.nombre ILIKE $${valores.length}`);
    }

    if (campus) {
      const campusLimpio = String(campus).replace(/^Campus\s+/i, "").trim();
      valores.push(`%${campusLimpio}%`);
      condiciones.push(`c.nombre ILIKE $${valores.length}`);
    }

    const where = condiciones.length > 0
      ? `WHERE ${condiciones.join(' AND ')}`
      : '';

    const resultado = await pool.query(
      `
      SELECT
        sr.id_solicitud AS id,
        sr.codigo_solicitud AS codigo,
        s.nombre AS solicitante,
        s.tipo_solicitante AS tipo,
        e.nombre AS espacio,
        sr.fecha_inicio AS fecha,
        sr.hora_inicio,
        sr.hora_fin,
        c.nombre AS campus,
        sr.estado
      FROM solicitud_reserva sr
      INNER JOIN solicitante s ON s.id_solicitante = sr.id_solicitante
      INNER JOIN espacio e ON e.id_espacio = sr.id_espacio
      INNER JOIN campus c ON c.id_campus = e.id_campus
      ${where}
      ORDER BY sr.fecha_registro DESC
      LIMIT 100
      `,
      valores
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar solicitudes:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron obtener las solicitudes.',
    });
  }
};
// Listar agenda (solo aprobadas vigentes)
export const listarAgenda = async (req, res) => {
  try {
    const {
      busqueda,
      fecha,
      campus,
      tipo_espacio,
      espacio,
      tipo,
      hora_inicio,
      hora_fin,
    } = req.query;

    const condiciones = [
      `sr.estado = 'Aprobada'`,
      `sr.fecha_fin >= CURRENT_DATE`,
    ];
    const valores = [];

    if (busqueda) {
      valores.push(`%${busqueda}%`);
      condiciones.push(`(
        sr.codigo_solicitud ILIKE $${valores.length}
        OR s.nombre ILIKE $${valores.length}
        OR sr.nombre_actividad ILIKE $${valores.length}
        OR e.nombre ILIKE $${valores.length}
      )`);
    }

    if (fecha) {
      valores.push(fecha);
      condiciones.push(`sr.fecha_inicio <= $${valores.length}::date AND sr.fecha_fin >= $${valores.length}::date`);
    }

    if (campus) {
      valores.push(`%${campus}%`);
      condiciones.push(`c.nombre ILIKE $${valores.length}`);
    }

    if (tipo_espacio) {
      valores.push(Number(tipo_espacio));
      condiciones.push(`e.id_tipo_espacio = $${valores.length}`);
    }

    if (espacio) {
      valores.push(Number(espacio));
      condiciones.push(`e.id_espacio = $${valores.length}`);
    }

    if (tipo) {
      valores.push(String(tipo).toLowerCase());
      condiciones.push(`s.tipo_solicitante = $${valores.length}`);
    }

    if (hora_inicio) {
      valores.push(hora_inicio);
      condiciones.push(`sr.hora_inicio >= $${valores.length}::time`);
    }

    if (hora_fin) {
      valores.push(hora_fin);
      condiciones.push(`sr.hora_fin <= $${valores.length}::time`);
    }

    const where = `WHERE ${condiciones.join(' AND ')}`;

    const resultado = await pool.query(
      `
      SELECT
        sr.id_solicitud AS id,
        sr.codigo_solicitud AS codigo,
        sr.nombre_actividad AS actividad,
        s.tipo_solicitante AS tipo,
        s.nombre AS solicitante,
        e.nombre AS espacio,
        c.nombre AS campus,
        sr.fecha_inicio AS fecha,
        sr.fecha_fin,
        sr.hora_inicio,
        sr.hora_fin,
        sr.estado,
        sr.es_recurrente
      FROM solicitud_reserva sr
      INNER JOIN solicitante s ON s.id_solicitante = sr.id_solicitante
      INNER JOIN espacio e ON e.id_espacio = sr.id_espacio
      INNER JOIN campus c ON c.id_campus = e.id_campus
      ${where}
      ORDER BY sr.fecha_inicio ASC, sr.hora_inicio ASC
      `,
      valores
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al listar agenda:', error);
    return res.status(500).json({
      mensaje: 'No se pudo obtener la agenda.',
    });
  }
};
// Historial de reservas (solo estados finalizados / gestionados)
export const listarHistorialReservas = async (req, res) => {
  try {
    const { anio, mes, programa, busqueda } = req.query;

    const condiciones = [
      `sr.estado IN ('Aprobada', 'Rechazada', 'Cancelada', 'Finalizada')`
    ];
    const valores = [];

    if (anio) {
      valores.push(anio);
      condiciones.push(`EXTRACT(YEAR FROM sr.fecha_inicio) = $${valores.length}`);
    }

    if (mes) {
      valores.push(Number(mes));
      condiciones.push(`EXTRACT(MONTH FROM sr.fecha_inicio) = $${valores.length}`);
    }

    if (programa) {
      valores.push(`%${programa}%`);
      condiciones.push(`p.nombre ILIKE $${valores.length}`);
    }

    if (busqueda) {
      valores.push(`%${busqueda}%`);
      condiciones.push(`(
        sr.codigo_solicitud ILIKE $${valores.length}
        OR s.nombre ILIKE $${valores.length}
      )`);
    }

    const where = `WHERE ${condiciones.join(' AND ')}`;

    const resultado = await pool.query(
      `
      SELECT
        sr.id_solicitud AS id,
        sr.codigo_solicitud AS codigo,
        sr.fecha_inicio AS fecha,
        sr.hora_inicio,
        sr.hora_fin,
        sr.estado,
        sr.fecha_registro,
        sr.fecha_actualizacion,
        s.nombre AS solicitante,
        s.tipo_solicitante AS tipo,
        e.nombre AS espacio,
        c.nombre AS campus,
        p.nombre AS programa
      FROM solicitud_reserva sr
      INNER JOIN solicitante s ON s.id_solicitante = sr.id_solicitante
      INNER JOIN espacio e ON e.id_espacio = sr.id_espacio
      INNER JOIN campus c ON c.id_campus = e.id_campus
      LEFT JOIN programa p ON p.id_programa = s.id_programa
      ${where}
      ORDER BY sr.fecha_inicio DESC, sr.fecha_registro DESC
      `,
      valores
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar historial de reservas:', error);
    return res.status(500).json({
      mensaje: 'No se pudo consultar el historial de reservas.',
    });
  }
};