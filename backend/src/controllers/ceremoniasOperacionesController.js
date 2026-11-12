import pool from '../db.js';
import { actualizarSesionesPorHorario } from '../services/estadoSesiones.js';
import { consultarRequisitosInicioCeremonia } from '../services/requisitosInicioCeremonia.js';
import { prepararSincronizacionGrados } from '../services/sincronizacionGradosPrueba.js';

const ID_INTEGER_REGEX = /^[1-9]\d*$/;
const ESTADOS_CEREMONIA = new Set(['Programada', 'En curso', 'Finalizada', 'Cancelada']);
const ESTADOS_SESION_CONFIGURABLES = new Set(['Programada', 'En curso', 'Finalizada']);
const MAX_FILAS_IMPORTACION = 1000;
const HORA_MINIMA_CEREMONIA = '07:00';
const HORA_MAXIMA_CEREMONIA = '20:00';

function errorHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function responderError(res, error, mensaje) {
  if (error.status) {
    return res.status(error.status).json({ mensaje: error.message });
  }
  if (error.code === '23505') {
    return res.status(409).json({ mensaje: 'Ya existe un registro con esos datos.' });
  }
  console.error(mensaje, error);
  return res.status(500).json({ mensaje });
}

function texto(value, maxLength, nombre, obligatorio = false) {
  const result = typeof value === 'string' ? value.trim() : '';
  if ((obligatorio && !result) || result.length > maxLength) {
    throw errorHttp(400, `${nombre} ${obligatorio ? 'es obligatorio' : 'no es válido'}.`);
  }
  return result;
}

function documentoCanonico(value) {
  const digitos = value.replace(/\D/g, '');
  return digitos || value.trim().toLowerCase();
}

function normalizarNombrePrograma(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function validarId(value, nombre) {
  if (
    typeof value !== 'string'
    || !ID_INTEGER_REGEX.test(value)
    || !Number.isSafeInteger(Number(value))
  ) {
    throw errorHttp(400, `El identificador de ${nombre} no es válido.`);
  }
}

function validarHora(value, nombre) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw errorHttp(400, `${nombre} no es válida.`);
  }
  return value;
}

function validarHorario(body) {
  const horaInicio = validarHora(body.horaInicio, 'La hora de inicio');
  const horaFin = validarHora(body.horaFin, 'La hora de finalización');
  if ([horaInicio, horaFin].some((hora) =>
    hora !== null && (hora < HORA_MINIMA_CEREMONIA || hora > HORA_MAXIMA_CEREMONIA)
  )) {
    throw errorHttp(400, 'Las horas de la ceremonia deben estar entre 07:00 AM y 08:00 PM.');
  }
  if ((horaInicio && !horaFin) || (!horaInicio && horaFin) || (horaInicio && horaInicio >= horaFin)) {
    throw errorHttp(400, 'Completa un rango de horas válido.');
  }
  return { horaInicio, horaFin };
}

async function obtenerCeremonia(executor, id, bloquear = false) {
  const resultado = await executor.query(
    `SELECT id_ceremonia::text AS id, estado, fecha,
            max_invitados_por_graduando AS "maxInvitadosPorGraduando",
            cupo_invitados AS "cupoInvitados"
     FROM public.ceremonia_grado
     WHERE id_ceremonia = $1
     ${bloquear ? 'FOR UPDATE' : ''}`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function validarSesionCeremonia(executor, ceremoniaId, sesionId) {
  const resultado = await executor.query(
    `SELECT 1
     FROM public.sesion
     WHERE id_sesion = $1 AND id_ceremonia = $2`,
    [sesionId, ceremoniaId],
  );
  return resultado.rowCount > 0;
}

async function obtenerSesion(executor, id) {
  const resultado = await executor.query(
    `SELECT
       s.id_sesion::text AS id,
       s.id_ceremonia::text AS "ceremoniaId",
       s.numero_sesion AS "numeroSesion",
       s.nombre,
       s.estado,
       s.estado_manual AS "estadoManual",
       TO_CHAR(s.hora_inicio, 'HH24:MI') AS "horaInicio",
       TO_CHAR(s.hora_fin, 'HH24:MI') AS "horaFin",
       COALESCE(
         ARRAY_AGG(DISTINCT p.nombre ORDER BY p.nombre)
           FILTER (WHERE p.id_programa IS NOT NULL),
         ARRAY[]::text[]
       ) AS programas,
       COALESCE(
         ARRAY_AGG(DISTINCT p.id_programa ORDER BY p.id_programa)
           FILTER (WHERE p.id_programa IS NOT NULL),
         ARRAY[]::integer[]
       ) AS "programaIds",
       (SELECT COUNT(*)::integer
        FROM public.graduando g
        WHERE g.id_sesion = s.id_sesion) AS "graduandosCount",
       (SELECT COUNT(*)::integer
        FROM public.invitado i
        INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
        WHERE g.id_sesion = s.id_sesion) AS "invitadosCount"
     FROM public.sesion s
     LEFT JOIN public.sesion_programa sp ON sp.id_sesion = s.id_sesion
     LEFT JOIN public.programa p ON p.id_programa = sp.id_programa
     WHERE s.id_sesion = $1
     GROUP BY s.id_sesion`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function obtenerGraduando(executor, id) {
  const resultado = await executor.query(
    `SELECT
       g.id_graduando::text AS id,
       g.id_ceremonia::text AS "ceremoniaId",
       g.id_sesion::text AS "sesionId",
       g.nombres,
       g.apellidos,
       g.identificacion AS documento,
       g.telefono,
       g.correo_electronico AS correo,
       g.codigo_estudiantil AS "codigoEstudiantil",
       g.talla_toga AS "tallaToga",
       COALESCE(
         STRING_AGG(DISTINCT p.nombre, ', ' ORDER BY p.nombre),
         'Sin programa'
       ) AS programa,
       COALESCE(
         ARRAY_AGG(DISTINCT p.id_programa ORDER BY p.id_programa)
           FILTER (WHERE p.id_programa IS NOT NULL),
         ARRAY[]::integer[]
       ) AS "programaIds",
       s.nombre AS "sesionLabel",
       COUNT(DISTINCT i.id_invitado)::integer AS "invitadosCount",
       g.requisitos_cumplidos AS "requisitosCumplidos",
       g.estado,
       CASE WHEN EXISTS (
         SELECT 1 FROM public.control_ingreso ci
         WHERE ci.id_graduando = g.id_graduando
           AND ci.id_sesion = g.id_sesion
           AND ci.ingreso = TRUE
       ) THEN 'Ingresó' ELSE 'Pendiente' END AS "estadoIngreso",
       (
         SELECT TO_CHAR(ci.hora_ingreso, 'FMHH12:MI AM')
         FROM public.control_ingreso ci
         WHERE ci.id_graduando = g.id_graduando
           AND ci.id_sesion = g.id_sesion
           AND ci.ingreso = TRUE
         ORDER BY ci.id_control_ingreso DESC
         LIMIT 1
       ) AS "horaIngreso"
     FROM public.graduando g
     LEFT JOIN public.sesion s ON s.id_sesion = g.id_sesion
     LEFT JOIN public.graduando_programa gp ON gp.id_graduando = g.id_graduando
     LEFT JOIN public.programa p ON p.id_programa = gp.id_programa
     LEFT JOIN public.invitado i ON i.id_graduando = g.id_graduando
     WHERE g.id_graduando = $1
     GROUP BY g.id_graduando, s.nombre`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function obtenerInvitado(executor, id) {
  const resultado = await executor.query(
    `SELECT
       i.id_invitado::text AS id,
       i.id_graduando::text AS "graduandoId",
       g.id_ceremonia::text AS "ceremoniaId",
       i.nombre,
       COALESCE(i.identificacion, '') AS documento,
       CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
       COALESCE(i.parentesco, 'Invitado') AS tipo,
       i.telefono,
       i.parentesco,
       CASE WHEN i.autorizado THEN 'Autorizado' ELSE 'Pendiente' END AS autorizacion,
       CASE WHEN EXISTS (
         SELECT 1 FROM public.control_ingreso ci
         WHERE ci.id_invitado = i.id_invitado
           AND ci.id_sesion = g.id_sesion
           AND ci.ingreso = TRUE
       ) THEN 'Ingresó' ELSE 'Pendiente' END AS "estadoIngreso",
       (
         SELECT TO_CHAR(ci.hora_ingreso, 'FMHH12:MI AM')
         FROM public.control_ingreso ci
         WHERE ci.id_invitado = i.id_invitado
           AND ci.id_sesion = g.id_sesion
           AND ci.ingreso = TRUE
         ORDER BY ci.id_control_ingreso DESC
         LIMIT 1
       ) AS "horaIngreso"
     FROM public.invitado i
     INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
     WHERE i.id_invitado = $1`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function validarProgramas(executor, programaIds) {
  if (
    !Array.isArray(programaIds)
    || programaIds.length !== 1
    || programaIds.some((id) => !Number.isInteger(id) || id <= 0)
  ) {
    throw errorHttp(400, 'Cada graduando debe tener exactamente un programa académico válido.');
  }
  const ids = programaIds;
  const resultado = await executor.query(
    `SELECT id_programa
     FROM public.programa
     WHERE estado = TRUE AND id_programa = ANY($1::integer[])`,
    [ids],
  );
  if (resultado.rowCount !== ids.length) {
    throw errorHttp(400, 'Uno o más programas no existen o están inactivos.');
  }
  return ids;
}

async function validarSesionParaGraduando(executor, ceremoniaId, sesionId, programaIds) {
  if (sesionId === null) return;
  if (
    typeof sesionId !== 'string'
    || !ID_INTEGER_REGEX.test(sesionId)
    || !Number.isSafeInteger(Number(sesionId))
  ) {
    throw errorHttp(400, 'La sesión seleccionada no es válida.');
  }
  const resultado = await executor.query(
    `SELECT 1
     FROM public.sesion s
     INNER JOIN public.sesion_programa sp ON sp.id_sesion = s.id_sesion
     WHERE s.id_sesion = $1
       AND s.id_ceremonia = $2
       AND sp.id_programa = ANY($3::integer[])
     LIMIT 1`,
    [sesionId, ceremoniaId, programaIds],
  );
  if (resultado.rowCount === 0) {
    throw errorHttp(400, 'La sesión no pertenece a la ceremonia o no está asociada al programa seleccionado.');
  }
}

function validarDatosGraduando(body) {
  const idSesionRecibido = body.idSesion ?? body.id_sesion ?? null;
  const idSesion = idSesionRecibido === '' ? null : idSesionRecibido;
  if (
    idSesion !== null
    && (
      typeof idSesion !== 'string'
      || !ID_INTEGER_REGEX.test(idSesion)
      || !Number.isSafeInteger(Number(idSesion))
    )
  ) {
    throw errorHttp(400, 'La sesión seleccionada no es válida.');
  }
  return {
    nombres: texto(body.nombres, 120, 'El nombre', true),
    apellidos: texto(body.apellidos, 120, 'El apellido', true),
    documento: texto(body.documento, 40, 'El documento', true),
    telefono: texto(body.telefono, 40, 'El teléfono'),
    correo: texto(body.correo, 254, 'El correo'),
    codigoEstudiantil: texto(body.codigoEstudiantil, 40, 'El código estudiantil'),
    tallaToga: texto(body.tallaToga, 20, 'La talla de toga'),
    idSesion,
    programaIds: body.programaIds,
    estado: body.estado === undefined ? true : body.estado,
    requisitosCumplidos: body.requisitosCumplidos === undefined
      ? false
      : body.requisitosCumplidos,
  };
}

async function documentoExiste(executor, ceremoniaId, documento, excluirId = null) {
  const canonico = documentoCanonico(documento);
  const resultado = await executor.query(
    `SELECT 1
     FROM public.graduando
     WHERE id_ceremonia = $1
       AND ($3::integer IS NULL OR id_graduando <> $3::integer)
       AND COALESCE(
         NULLIF(REGEXP_REPLACE(identificacion, '[^0-9]', '', 'g'), ''),
         LOWER(BTRIM(identificacion))
       ) = $2
     LIMIT 1`,
    [ceremoniaId, canonico, excluirId],
  );
  return resultado.rowCount > 0;
}

async function resolverProgramasPorNombre(executor, nombres) {
  if (!Array.isArray(nombres) || nombres.some((nombre) => typeof nombre !== 'string')) {
    throw errorHttp(400, 'La lista de programas de la sesión no es válida.');
  }
  const normalizados = nombres.map(normalizarNombrePrograma);
  if (normalizados.some((nombre) => !nombre) || new Set(normalizados).size !== nombres.length) {
    throw errorHttp(400, 'La lista de programas contiene nombres vacíos o repetidos.');
  }
  if (normalizados.length === 0) return [];
  const resultado = await executor.query(
    `SELECT id_programa, nombre
     FROM public.programa
     WHERE estado = TRUE`,
  );
  const programas = new Map(
    resultado.rows.map((programa) => [
      normalizarNombrePrograma(programa.nombre),
      programa.id_programa,
    ]),
  );
  const ids = normalizados.map((nombre) => programas.get(nombre));
  if (ids.some((id) => !Number.isInteger(id))) {
    throw errorHttp(400, 'Uno o más programas no existen o están inactivos.');
  }
  return ids;
}

export async function obtenerSesionPorId(req, res) {
  try {
    validarId(req.params.id, 'sesión');
    const sesion = await obtenerSesion(pool, req.params.id);
    if (!sesion) return res.status(404).json({ mensaje: 'La sesión no existe.' });
    return res.json(sesion);
  } catch (error) {
    return responderError(res, error, 'No se pudo consultar la sesión.');
  }
}

export async function crearSesion(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'ceremonia');
    const nombreSolicitado = texto(req.body?.nombre, 180, 'El nombre de la sesión');
    const { horaInicio, horaFin } = validarHorario(req.body ?? {});

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await obtenerCeremonia(client, req.params.id, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');

    const numero = await client.query(
      `SELECT COALESCE(MAX(numero_sesion), 0)::integer + 1 AS numero
       FROM public.sesion
       WHERE id_ceremonia = $1`,
      [req.params.id],
    );
    const nombre = nombreSolicitado || `Sesión ${numero.rows[0].numero}`;
    const insertado = await client.query(
      `INSERT INTO public.sesion (
         id_ceremonia, numero_sesion, nombre, estado, hora_inicio, hora_fin
       )
       VALUES ($1, $2, $3, 'Pendiente', $4::time, $5::time)
       RETURNING id_sesion::text AS id`,
      [req.params.id, numero.rows[0].numero, nombre, horaInicio, horaFin],
    );
    await client.query('COMMIT');
    transaccion = false;
    return res.status(201).json(await obtenerSesion(pool, insertado.rows[0].id));
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible crear la sesión.');
  } finally {
    client?.release();
  }
}

export async function actualizarSesion(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'sesión');
    const nombre = texto(req.body?.nombre, 180, 'El nombre de la sesión', true);
    const estadoSolicitado = req.body?.estado;
    if (!ESTADOS_SESION_CONFIGURABLES.has(estadoSolicitado)) {
      throw errorHttp(400, 'El estado de la sesión no es válido.');
    }
    if (req.body?.estadoManual !== undefined && typeof req.body.estadoManual !== 'boolean') {
      throw errorHttp(400, 'El modo de estado de la sesión no es válido.');
    }
    const { horaInicio, horaFin } = validarHorario(req.body ?? {});
    if (!horaInicio || !horaFin) {
      throw errorHttp(400, 'Configura una hora de inicio y finalización para la sesión.');
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const sesionResultado = await client.query(
      `SELECT id_sesion::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.sesion
       WHERE id_sesion = $1`,
      [req.params.id],
    );
    const sesionActual = sesionResultado.rows[0];
    if (!sesionActual) throw errorHttp(404, 'La sesión no existe.');
    const ceremonia = await obtenerCeremonia(client, sesionActual.ceremoniaId, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia de la sesión no existe.');
    const sesionBloqueada = await client.query(
      `SELECT estado, estado_manual AS "estadoManual" FROM public.sesion
       WHERE id_sesion = $1 AND id_ceremonia = $2
       FOR UPDATE`,
      [req.params.id, sesionActual.ceremoniaId],
    );
    if (sesionBloqueada.rowCount === 0) {
      throw errorHttp(409, 'La sesión ya no pertenece a esta ceremonia.');
    }

    const estadoAnterior = sesionBloqueada.rows[0];
    const cambioManual = estadoAnterior.estado !== 'Pendiente'
      && estadoSolicitado !== estadoAnterior.estado;
    const estadoManual = req.body?.estadoManual ?? (cambioManual || estadoAnterior.estadoManual);
    let estado = estadoSolicitado;
    if (!estadoManual) {
      const estadoPorHorario = await client.query(
        `SELECT CASE
           WHEN $4 <> 'En curso' THEN 'Programada'
           WHEN $1::time IS NULL OR $2::time IS NULL THEN 'Programada'
           WHEN $3::date + $2::time <= LOCALTIMESTAMP THEN 'Finalizada'
           WHEN $3::date + $1::time <= LOCALTIMESTAMP THEN 'En curso'
           ELSE 'Programada'
         END AS estado`,
        [horaInicio, horaFin, ceremonia.fecha, ceremonia.estado],
      );
      estado = estadoPorHorario.rows[0].estado;
    }

    const programaIds = await resolverProgramasPorNombre(client, req.body?.programas);
    if (programaIds.length > 0) {
      const conflicto = await client.query(
        `SELECT p.nombre AS programa, s.nombre AS sesion
         FROM public.sesion_programa sp
         INNER JOIN public.sesion s ON s.id_sesion = sp.id_sesion
         INNER JOIN public.programa p ON p.id_programa = sp.id_programa
         WHERE s.id_ceremonia = $1 AND s.id_sesion <> $2
           AND sp.id_programa = ANY($3::integer[])
         ORDER BY p.nombre, s.numero_sesion
         LIMIT 1`,
        [sesionActual.ceremoniaId, req.params.id, programaIds],
      );
      if (conflicto.rowCount > 0) {
        const { programa, sesion } = conflicto.rows[0];
        throw errorHttp(409, `El programa ${programa} ya está asignado a la sesión ${sesion} de esta ceremonia.`);
      }
    }
    if (programaIds.length === 0) {
      const graduandosAsignados = await client.query(
        'SELECT 1 FROM public.graduando WHERE id_sesion = $1 LIMIT 1',
        [req.params.id],
      );
      if (graduandosAsignados.rowCount > 0) {
        throw errorHttp(409, 'No puedes quitar todos los programas mientras haya graduandos asignados a esta sesión.');
      }
    } else {
      const incompatibles = await client.query(
        `SELECT 1
         FROM public.graduando g
         INNER JOIN public.graduando_programa gp ON gp.id_graduando = g.id_graduando
         WHERE g.id_sesion = $1
           AND NOT (gp.id_programa = ANY($2::integer[]))
         LIMIT 1`,
        [req.params.id, programaIds],
      );
      if (incompatibles.rowCount > 0) {
        throw errorHttp(409, 'La sesión tiene graduandos de programas que no están en la nueva selección.');
      }
    }

    await client.query(
      `UPDATE public.sesion
      SET nombre = $2, estado = $3, hora_inicio = $4::time, hora_fin = $5::time, estado_manual = $6
      WHERE id_sesion = $1`,
      [req.params.id, nombre, estado, horaInicio, horaFin, estadoManual],
    );
    await client.query(
      'DELETE FROM public.sesion_programa WHERE id_sesion = $1',
      [req.params.id],
    );
    for (const programaId of programaIds) {
      await client.query(
        `INSERT INTO public.sesion_programa (id_sesion, id_programa)
         VALUES ($1, $2)`,
        [req.params.id, programaId],
      );
    }
    const asignacionAutomatica = await client.query(
      `UPDATE public.graduando g
       SET id_sesion = $1
       WHERE g.id_ceremonia = $2
         AND g.id_sesion IS NULL
         AND EXISTS (
           SELECT 1
           FROM public.graduando_programa gp
           WHERE gp.id_graduando = g.id_graduando
             AND gp.id_programa = ANY($3::integer[])
         )
       RETURNING g.id_graduando`,
      [req.params.id, sesionActual.ceremoniaId, programaIds],
    );
    await client.query('COMMIT');
    transaccion = false;
    const sesionActualizada = await obtenerSesion(pool, req.params.id);
    return res.json({
      ...sesionActualizada,
      graduandosAsignados: asignacionAutomatica.rowCount,
    });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible actualizar la sesión.');
  } finally {
    client?.release();
  }
}

export async function obtenerRequisitosInicioCeremonia(req, res) {
  try {
    validarId(req.params.id, 'ceremonia');
    const ceremonia = await obtenerCeremonia(pool, req.params.id);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
    return res.json(await consultarRequisitosInicioCeremonia(pool, req.params.id));
  } catch (error) {
    return responderError(res, error, 'No fue posible consultar los requisitos para iniciar la ceremonia.');
  }
}

export async function actualizarEstadoCeremonia(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'ceremonia');
    const { estado } = req.body ?? {};
    if (!ESTADOS_CEREMONIA.has(estado)) {
      throw errorHttp(400, 'El estado de la ceremonia no es válido.');
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await obtenerCeremonia(client, req.params.id, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
    if (estado === 'En curso' && ceremonia.estado !== 'En curso') {
      const requisitos = await consultarRequisitosInicioCeremonia(client, req.params.id);
      if (!requisitos.puedeIniciar) {
        throw errorHttp(409, `No se puede iniciar la ceremonia. ${requisitos.pendientes.join(' ')}`);
      }
    }
    await client.query(
      `UPDATE public.ceremonia_grado
       SET estado = $2
       WHERE id_ceremonia = $1`,
      [req.params.id, estado],
    );
    let sesionesIniciadas = [];
    let sesionesFinalizadas = 0;
    let sesionesFinalizadasPorHorario = [];
    if (estado === 'En curso') {
      const resultado = await actualizarSesionesPorHorario(client, req.params.id);
      sesionesIniciadas = resultado.rows.filter((sesion) => sesion.estado === 'En curso').map((sesion) => sesion.id);
      sesionesFinalizadasPorHorario = resultado.rows.filter((sesion) => sesion.estado === 'Finalizada').map((sesion) => sesion.id);
    }
    if (estado === 'Finalizada') {
      const resultado = await client.query(
        `UPDATE public.sesion
         SET estado = 'Finalizada'
         WHERE id_ceremonia = $1 AND estado <> 'Finalizada'`,
        [req.params.id],
      );
      sesionesFinalizadas = resultado.rowCount;
      await prepararSincronizacionGrados(client, req.params.id);
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json({ id: req.params.id, estado, sesionesIniciadas, sesionesFinalizadas, sesionesFinalizadasPorHorario });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible cambiar el estado de la ceremonia.');
  } finally {
    client?.release();
  }
}

export async function actualizarMaxInvitadosPorGraduando(req, res) {
  try {
    validarId(req.params.id, 'ceremonia');
    const limite = Number(req.body?.maxInvitadosPorGraduando);
    if (![2, 3, 4].includes(limite)) {
      throw errorHttp(400, 'El máximo de invitados por graduando debe ser 2, 3 o 4.');
    }
    const resultado = await pool.query(
      `UPDATE public.ceremonia_grado
       SET max_invitados_por_graduando = $2
       WHERE id_ceremonia = $1
       RETURNING id_ceremonia::text AS id, max_invitados_por_graduando AS "maxInvitadosPorGraduando"`,
      [req.params.id, limite],
    );
    if (resultado.rowCount === 0) return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    return res.json(resultado.rows[0]);
  } catch (error) {
    return responderError(res, error, 'No fue posible actualizar el límite de invitados.');
  }
}

export async function actualizarCupoInvitados(req, res) {
  try {
    validarId(req.params.id, 'ceremonia');
    const cupo = Number(req.body?.cupoInvitados);
    if (!Number.isInteger(cupo) || cupo < 0) {
      throw errorHttp(400, 'El cupo de invitados debe ser un número entero igual o mayor que cero.');
    }
    const resultado = await pool.query(
      `UPDATE public.ceremonia_grado
       SET cupo_invitados = $2
       WHERE id_ceremonia = $1
       RETURNING id_ceremonia::text AS id, cupo_invitados AS "cupoInvitados"`,
      [req.params.id, cupo],
    );
    if (resultado.rowCount === 0) return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    const conteo = await pool.query(
      `SELECT COUNT(*)::integer AS "invitadosRegistrados"
       FROM public.invitado i
       INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
       WHERE g.id_ceremonia = $1`,
      [req.params.id],
    );
    const invitadosRegistrados = conteo.rows[0].invitadosRegistrados;
    return res.json({
      ...resultado.rows[0],
      invitadosRegistrados,
      invitadosExcedidos: Math.max(0, invitadosRegistrados - cupo),
    });
  } catch (error) {
    return responderError(res, error, 'No fue posible actualizar el cupo de invitados.');
  }
}

export async function obtenerGraduandoPorId(req, res) {
  try {
    validarId(req.params.id, 'graduando');
    const graduando = await obtenerGraduando(pool, req.params.id);
    if (!graduando) return res.status(404).json({ mensaje: 'El graduando no existe.' });
    return res.json(graduando);
  } catch (error) {
    return responderError(res, error, 'No se pudo consultar el graduando.');
  }
}

export async function crearGraduando(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'ceremonia');
    const datos = validarDatosGraduando(req.body ?? {});
    if (typeof datos.estado !== 'boolean' || typeof datos.requisitosCumplidos !== 'boolean') {
      throw errorHttp(400, 'El estado y los requisitos del graduando no son válidos.');
    }
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await obtenerCeremonia(client, req.params.id, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
    const programaIds = await validarProgramas(client, datos.programaIds);
    await validarSesionParaGraduando(client, req.params.id, datos.idSesion, programaIds);
    if (await documentoExiste(client, req.params.id, datos.documento)) {
      throw errorHttp(409, 'Ya existe un graduando con ese documento en esta ceremonia.');
    }

    const insertado = await client.query(
      `INSERT INTO public.graduando (
         id_ceremonia, id_sesion, nombres, apellidos, identificacion, telefono,
         correo_electronico, codigo_estudiantil, talla_toga, estado, requisitos_cumplidos
       )
       VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''),
               NULLIF($8, ''), NULLIF($9, ''), $10, $11)
       RETURNING id_graduando::text AS id`,
      [
        req.params.id, datos.idSesion, datos.nombres, datos.apellidos,
        datos.documento, datos.telefono, datos.correo, datos.codigoEstudiantil,
        datos.tallaToga, datos.estado, datos.requisitosCumplidos,
      ],
    );
    const id = insertado.rows[0].id;
    for (const programaId of programaIds) {
      await client.query(
        `INSERT INTO public.graduando_programa (id_graduando, id_programa)
         VALUES ($1, $2)`,
        [id, programaId],
      );
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.status(201).json(await obtenerGraduando(pool, id));
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible crear el graduando.');
  } finally {
    client?.release();
  }
}

export async function actualizarGraduando(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'graduando');
    const datos = validarDatosGraduando(req.body ?? {});
    if (typeof datos.estado !== 'boolean' || typeof datos.requisitosCumplidos !== 'boolean') {
      throw errorHttp(400, 'El estado y los requisitos del graduando no son válidos.');
    }
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const graduandoResultado = await client.query(
      `SELECT id_graduando::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.graduando
       WHERE id_graduando = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const graduandoActual = graduandoResultado.rows[0];
    if (!graduandoActual) throw errorHttp(404, 'El graduando no existe.');
    await obtenerCeremonia(client, graduandoActual.ceremoniaId, true);
    const programaIds = await validarProgramas(client, datos.programaIds);
    await validarSesionParaGraduando(
      client,
      graduandoActual.ceremoniaId,
      datos.idSesion,
      programaIds,
    );
    if (await documentoExiste(
      client,
      graduandoActual.ceremoniaId,
      datos.documento,
      req.params.id,
    )) {
      throw errorHttp(409, 'Ya existe otro graduando con ese documento en esta ceremonia.');
    }

    await client.query(
      `UPDATE public.graduando
       SET id_sesion = $2, nombres = $3, apellidos = $4, identificacion = $5,
           telefono = NULLIF($6, ''), correo_electronico = NULLIF($7, ''),
           codigo_estudiantil = NULLIF($8, ''), talla_toga = NULLIF($9, ''),
           estado = $10, requisitos_cumplidos = $11
       WHERE id_graduando = $1`,
      [
        req.params.id, datos.idSesion, datos.nombres, datos.apellidos,
        datos.documento, datos.telefono, datos.correo, datos.codigoEstudiantil,
        datos.tallaToga, datos.estado, datos.requisitosCumplidos,
      ],
    );
    await client.query(
      'DELETE FROM public.graduando_programa WHERE id_graduando = $1',
      [req.params.id],
    );
    for (const programaId of programaIds) {
      await client.query(
        `INSERT INTO public.graduando_programa (id_graduando, id_programa)
         VALUES ($1, $2)`,
        [req.params.id, programaId],
      );
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json(await obtenerGraduando(pool, req.params.id));
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible actualizar el graduando.');
  } finally {
    client?.release();
  }
}

export async function obtenerGraduandoPorDocumento(req, res) {
  try {
    const documento = texto(req.params.documento, 40, 'El documento', true);
    const resultado = await pool.query(
      `SELECT g.id_graduando::text AS id
       FROM public.graduando g
       INNER JOIN public.ceremonia_grado c ON c.id_ceremonia = g.id_ceremonia
       WHERE COALESCE(
         NULLIF(REGEXP_REPLACE(g.identificacion, '[^0-9]', '', 'g'), ''),
         LOWER(BTRIM(g.identificacion))
       ) = $1
         AND c.estado NOT IN ('Finalizada', 'Cancelada')
       ORDER BY c.fecha DESC
       LIMIT 2`,
      [documentoCanonico(documento)],
    );
    if (resultado.rowCount === 0) return res.status(404).json({ mensaje: 'No se encontró el graduando.' });
    if (resultado.rowCount > 1) {
      return res.status(409).json({ mensaje: 'El documento aparece en más de una ceremonia activa.' });
    }
    return res.json(await obtenerGraduando(pool, resultado.rows[0].id));
  } catch (error) {
    return responderError(res, error, 'No se pudo consultar el graduando por documento.');
  }
}

async function validarFilasImportacion(executor, ceremoniaId, filas) {
  if (!Array.isArray(filas) || filas.length === 0 || filas.length > MAX_FILAS_IMPORTACION) {
    throw errorHttp(400, `Debes enviar entre una y ${MAX_FILAS_IMPORTACION} filas para importar.`);
  }
  const ceremonia = await obtenerCeremonia(executor, ceremoniaId);
  if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');

  const programas = await executor.query(
    `SELECT id_programa, nombre
     FROM public.programa
     WHERE estado = TRUE`,
  );
  const programasPorNombre = new Map(
    programas.rows.map((programa) => [
      normalizarNombrePrograma(programa.nombre),
      programa.id_programa,
    ]),
  );
  const sesiones = await executor.query(
    `SELECT s.numero_sesion, s.id_sesion::text AS id,
            COALESCE(
              ARRAY_AGG(sp.id_programa)
                FILTER (WHERE sp.id_programa IS NOT NULL),
              ARRAY[]::integer[]
            ) AS "programaIds"
     FROM public.sesion s
     LEFT JOIN public.sesion_programa sp ON sp.id_sesion = s.id_sesion
     WHERE s.id_ceremonia = $1
     GROUP BY s.id_sesion`,
    [ceremoniaId],
  );
  const sesionesPorNumero = new Map(
    sesiones.rows.map((sesion) => [String(sesion.numero_sesion), sesion]),
  );
  const existentes = await executor.query(
    `SELECT DISTINCT COALESCE(
       NULLIF(REGEXP_REPLACE(identificacion, '[^0-9]', '', 'g'), ''),
       LOWER(BTRIM(identificacion))
     ) AS documento
     FROM public.graduando
     WHERE id_ceremonia = $1`,
    [ceremoniaId],
  );
  const documentosExistentes = new Set(existentes.rows.map((fila) => fila.documento));
  const documentosArchivo = new Set();
  const reporte = [];
  const validas = [];

  filas.forEach((fila, indice) => {
    const filaExcel = Number.isInteger(fila?.filaExcel) && fila.filaExcel > 0
      ? fila.filaExcel
      : indice + 2;
    const errores = [];
    const leerCampo = (valor, maximo, etiqueta) => {
      const resultado = String(valor ?? '').trim();
      if (resultado.length > maximo) errores.push(`${etiqueta} supera el máximo permitido.`);
      return resultado;
    };
    const identificacion = leerCampo(fila?.identificacion, 40, 'La identificación');
    const nombres = leerCampo(fila?.nombres, 120, 'Los nombres');
    const apellidos = leerCampo(fila?.apellidos, 120, 'Los apellidos');
    const correo = leerCampo(fila?.correo_electronico, 254, 'El correo');
    const telefono = leerCampo(fila?.telefono, 40, 'El teléfono');
    const codigoEstudiantil = leerCampo(fila?.codigo_estudiantil, 40, 'El código estudiantil');
    const tallaToga = leerCampo(fila?.talla_toga, 20, 'La talla de toga');
    const nombrePrograma = leerCampo(fila?.programa, 180, 'El programa');
    const numeroSesion = leerCampo(fila?.sesion, 20, 'La sesión');

    if (!identificacion) errores.push('La identificación es obligatoria.');
    if (!nombres) errores.push('Los nombres son obligatorios.');
    if (!apellidos) errores.push('Los apellidos son obligatorios.');
    if (!nombrePrograma) errores.push('El programa es obligatorio.');
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      errores.push('El correo electrónico no tiene un formato válido.');
    }

    const documento = identificacion ? documentoCanonico(identificacion) : '';
    if (documento) {
      if (documentosExistentes.has(documento)) errores.push('El documento ya está registrado en esta ceremonia.');
      if (documentosArchivo.has(documento)) errores.push('El documento está duplicado en el archivo.');
      documentosArchivo.add(documento);
    }

    const programaId = programasPorNombre.get(normalizarNombrePrograma(nombrePrograma));
    if (nombrePrograma && !programaId) {
      errores.push('El programa no coincide con un programa activo. Usa un nombre de la hoja Catalogos de la plantilla.');
    }

    let idSesion = null;
    if (numeroSesion) {
      const sesion = sesionesPorNumero.get(numeroSesion);
      if (!/^\d+$/.test(numeroSesion) || !sesion) {
        errores.push('La sesión no existe en esta ceremonia.');
      } else if (programaId && !sesion.programaIds.includes(programaId)) {
        errores.push('La sesión no está asociada al programa indicado.');
      } else {
        idSesion = sesion.id;
      }
    }

    if (errores.length > 0) {
      reporte.push({ filaExcel, identificacion, errores });
      return;
    }
    validas.push({
      documento: identificacion,
      nombres,
      apellidos,
      correo,
      telefono,
      codigoEstudiantil,
      tallaToga,
      idSesion,
      programaId,
    });
  });

  return {
    total: filas.length,
    validos: validas.length,
    invalidos: reporte.length,
    reporte,
    validas,
  };
}

export async function validarImportacionGraduandos(req, res) {
  try {
    validarId(req.params.id, 'ceremonia');
    const resultado = await validarFilasImportacion(pool, req.params.id, req.body?.filas);
    const { validas, ...resumen } = resultado;
    return res.json(resumen);
  } catch (error) {
    return responderError(res, error, 'No fue posible validar las filas de graduandos.');
  }
}

export async function confirmarImportacionGraduandos(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'ceremonia');
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await obtenerCeremonia(client, req.params.id, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
    const validacion = await validarFilasImportacion(client, req.params.id, req.body?.filas);
    let importados = 0;
    for (const fila of validacion.validas) {
      const resultado = await client.query(
        `INSERT INTO public.graduando (
           id_ceremonia, id_sesion, nombres, apellidos, identificacion, telefono,
           correo_electronico, codigo_estudiantil, talla_toga
         )
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''),
                 NULLIF($8, ''), NULLIF($9, ''))
         RETURNING id_graduando::text AS id`,
        [
          req.params.id, fila.idSesion, fila.nombres, fila.apellidos,
          fila.documento, fila.telefono, fila.correo, fila.codigoEstudiantil,
          fila.tallaToga,
        ],
      );
      const graduandoId = resultado.rows[0].id;
      await client.query(
        `INSERT INTO public.graduando_programa (id_graduando, id_programa)
         VALUES ($1, $2)`,
        [graduandoId, fila.programaId],
      );
      importados += 1;
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json({
      total: validacion.total,
      validos: importados,
      invalidos: validacion.invalidos,
      reporte: validacion.reporte,
      importados,
    });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible importar los graduandos.');
  } finally {
    client?.release();
  }
}

async function obtenerInvitados(executor, ceremoniaId, graduandoId = null) {
  const valores = [ceremoniaId];
  const condicionGraduando = graduandoId ? 'AND i.id_graduando = $2' : '';
  if (graduandoId) valores.push(graduandoId);
  const resultado = await executor.query(
    `SELECT
       i.id_invitado::text AS id,
       i.id_graduando::text AS "graduandoId",
       g.id_ceremonia::text AS "ceremoniaId",
       i.nombre,
       COALESCE(i.identificacion, '') AS documento,
       CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
       COALESCE(i.parentesco, 'Invitado') AS tipo,
       i.telefono,
       i.parentesco,
       CASE WHEN i.autorizado THEN 'Autorizado' ELSE 'Pendiente' END AS autorizacion,
       CASE WHEN EXISTS (
         SELECT 1 FROM public.control_ingreso ci
         WHERE ci.id_invitado = i.id_invitado
           AND ci.id_sesion = g.id_sesion
           AND ci.ingreso = TRUE
       ) THEN 'Ingresó' ELSE 'Pendiente' END AS "estadoIngreso",
       (
         SELECT TO_CHAR(ci.hora_ingreso, 'FMHH12:MI AM')
         FROM public.control_ingreso ci
         WHERE ci.id_invitado = i.id_invitado
           AND ci.id_sesion = g.id_sesion
           AND ci.ingreso = TRUE
         ORDER BY ci.id_control_ingreso DESC
         LIMIT 1
       ) AS "horaIngreso"
     FROM public.invitado i
     INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
     WHERE g.id_ceremonia = $1 ${condicionGraduando}
     ORDER BY g.apellidos, g.nombres, i.nombre`,
    valores,
  );
  return resultado.rows;
}

export async function listarInvitadosCeremonia(req, res) {
  try {
    validarId(req.params.id, 'ceremonia');
    const ceremonia = await obtenerCeremonia(pool, req.params.id);
    if (!ceremonia) return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    let graduandoId = null;
    if (req.query.graduandoId !== undefined) {
      graduandoId = req.query.graduandoId;
      validarId(graduandoId, 'graduando');
      const graduando = await pool.query(
        'SELECT 1 FROM public.graduando WHERE id_graduando = $1 AND id_ceremonia = $2',
        [graduandoId, req.params.id],
      );
      if (graduando.rowCount === 0) {
        return res.status(404).json({ mensaje: 'El graduando no pertenece a esta ceremonia.' });
      }
    }
    return res.json(await obtenerInvitados(pool, req.params.id, graduandoId));
  } catch (error) {
    return responderError(res, error, 'No se pudieron consultar los invitados.');
  }
}

function validarDatosInvitado(body) {
  if (body.autorizacion !== undefined && body.autorizacion !== 'Autorizado') {
    throw errorHttp(400, 'La autorización de invitados se asigna automáticamente y no se puede seleccionar.');
  }
  const documento = texto(body.documento, 40, 'El documento');
  if (documento && !/^\d+$/.test(documento)) {
    throw errorHttp(400, 'El documento del invitado debe contener solo dígitos.');
  }
  return {
    nombre: texto(body.nombre, 180, 'El nombre del invitado', true),
    documento,
    telefono: texto(body.telefono, 40, 'El teléfono'),
    parentesco: texto(body.parentesco ?? body.tipo, 80, 'El parentesco o tipo'),
  };
}

async function crearInvitado(client, ceremoniaId, graduandoId, datos) {
  if (datos.documento) {
    const duplicado = await client.query(
      `SELECT 1
       FROM public.invitado
       WHERE id_graduando = $1
         AND COALESCE(
           NULLIF(REGEXP_REPLACE(identificacion, '[^0-9]', '', 'g'), ''),
           LOWER(BTRIM(identificacion))
         ) = $2
       LIMIT 1`,
      [graduandoId, documentoCanonico(datos.documento)],
    );
    if (duplicado.rowCount > 0) {
      throw errorHttp(409, 'El documento ya está registrado para este graduando.');
    }
  }
  const resultado = await client.query(
    `INSERT INTO public.invitado (
       id_graduando, nombre, identificacion, telefono, parentesco, autorizado
     )
     VALUES ($1, $2, NULLIF($3, ''), NULLIF($4, ''), NULLIF($5, ''), TRUE)
     RETURNING id_invitado::text AS id`,
    [
      graduandoId, datos.nombre, datos.documento, datos.telefono,
      datos.parentesco,
    ],
  );
  return resultado.rows[0].id;
}

async function validarCupoInvitados(client, ceremoniaId, graduandoId, cantidadNueva) {
  const ceremonia = await obtenerCeremonia(client, ceremoniaId, true);
  if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
  const conteos = await client.query(
    `SELECT
       (SELECT COUNT(*)::integer
        FROM public.invitado
        WHERE id_graduando = $1) AS "invitadosGraduando"`,
    [graduandoId],
  );
  const { invitadosGraduando } = conteos.rows[0];
  if (invitadosGraduando + cantidadNueva > ceremonia.maxInvitadosPorGraduando) {
    throw errorHttp(
      409,
      `Este graduando ya alcanzó el límite de ${ceremonia.maxInvitadosPorGraduando} invitados.`,
    );
  }
}

export async function agregarInvitado(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'graduando');
    const datos = validarDatosInvitado(req.body ?? {});
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const graduando = await client.query(
      `SELECT id_graduando::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.graduando
       WHERE id_graduando = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const registro = graduando.rows[0];
    if (!registro) throw errorHttp(404, 'El graduando no existe.');
    await validarCupoInvitados(client, registro.ceremoniaId, req.params.id, 1);
    const id = await crearInvitado(client, registro.ceremoniaId, req.params.id, datos);
    await client.query('COMMIT');
    transaccion = false;
    return res.status(201).json(await obtenerInvitado(pool, id));
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible agregar el invitado.');
  } finally {
    client?.release();
  }
}

export async function agregarInvitadosLote(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'graduando');
    const invitados = req.body?.invitados;
    if (!Array.isArray(invitados) || invitados.length === 0 || invitados.length > 4) {
      throw errorHttp(400, 'Debes enviar entre uno y cuatro invitados.');
    }
    const datos = invitados.map(validarDatosInvitado);
    const documentos = datos.map((invitado) => documentoCanonico(invitado.documento))
      .filter(Boolean);
    if (new Set(documentos).size !== documentos.length) {
      throw errorHttp(400, 'La lista contiene documentos de invitado repetidos.');
    }

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const graduando = await client.query(
      `SELECT id_graduando::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.graduando
       WHERE id_graduando = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const registro = graduando.rows[0];
    if (!registro) throw errorHttp(404, 'El graduando no existe.');
    await validarCupoInvitados(client, registro.ceremoniaId, req.params.id, datos.length);
    const ids = [];
    for (const invitado of datos) {
      ids.push(await crearInvitado(client, registro.ceremoniaId, req.params.id, invitado));
    }
    await client.query('COMMIT');
    transaccion = false;
    const resultado = [];
    for (const id of ids) resultado.push(await obtenerInvitado(pool, id));
    return res.status(201).json(resultado);
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible agregar los invitados.');
  } finally {
    client?.release();
  }
}

export async function actualizarInvitado(req, res) {
  try {
    validarId(req.params.id, 'invitado');
    if (req.body?.autorizacion !== undefined) {
      throw errorHttp(400, 'La autorización de invitados se asigna automáticamente y no se puede modificar.');
    }
    const datos = validarDatosInvitado(req.body ?? {});
    if (datos.documento) {
      const duplicado = await pool.query(
        `SELECT 1
         FROM public.invitado actual
         INNER JOIN public.invitado otro
           ON otro.id_graduando = actual.id_graduando
          AND otro.id_invitado <> actual.id_invitado
         WHERE actual.id_invitado = $1
           AND COALESCE(
             NULLIF(REGEXP_REPLACE(otro.identificacion, '[^0-9]', '', 'g'), ''),
             LOWER(BTRIM(otro.identificacion))
           ) = $2
         LIMIT 1`,
        [req.params.id, documentoCanonico(datos.documento)],
      );
      if (duplicado.rowCount > 0) {
        throw errorHttp(409, 'El documento ya está registrado para este graduando.');
      }
    }
    const resultado = await pool.query(
      `UPDATE public.invitado
       SET nombre = $2, identificacion = NULLIF($3, ''), telefono = NULLIF($4, ''),
           parentesco = NULLIF($5, '')
       WHERE id_invitado = $1`,
      [
        req.params.id, datos.nombre, datos.documento, datos.telefono,
        datos.parentesco,
      ],
    );
    if (resultado.rowCount === 0) return res.status(404).json({ mensaje: 'El invitado no existe.' });
    return res.json(await obtenerInvitado(pool, req.params.id));
  } catch (error) {
    return responderError(res, error, 'No fue posible actualizar el invitado.');
  }
}

async function validarSesionControl(req, res) {
  const sesionId = req.query.sesion ?? req.body?.id_sesion;
  try {
    validarId(req.params.id, 'ceremonia');
    validarId(sesionId, 'sesión');
    const existe = await validarSesionCeremonia(pool, req.params.id, sesionId);
    if (!existe) {
      res.status(404).json({ mensaje: 'La sesión no existe o no pertenece a esta ceremonia.' });
      return null;
    }
    return sesionId;
  } catch (error) {
    responderError(res, error, 'No se pudo validar la sesión.');
    return null;
  }
}

async function obtenerEstadisticasControl(executor, ceremoniaId, sesionId) {
  const [graduandos, invitados] = await Promise.all([
    executor.query(
      `SELECT COUNT(*)::integer AS registrados,
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1
                  FROM public.control_ingreso ci
                  WHERE ci.id_graduando = g.id_graduando
                    AND ci.id_sesion = $2
                    AND ci.ingreso = TRUE
                )
              )::integer AS ingresaron
       FROM public.graduando g
       WHERE id_ceremonia = $1 AND id_sesion = $2 AND estado = TRUE`,
      [ceremoniaId, sesionId],
    ),
    executor.query(
      `SELECT COUNT(*)::integer AS registrados,
              COUNT(*) FILTER (
                WHERE EXISTS (
                  SELECT 1
                  FROM public.control_ingreso ci
                  WHERE ci.id_invitado = i.id_invitado
                    AND ci.id_sesion = $2
                    AND ci.ingreso = TRUE
                )
              )::integer AS ingresaron
       FROM public.invitado i
       INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
       WHERE g.id_ceremonia = $1
         AND g.id_sesion = $2
         AND g.estado = TRUE
         AND i.autorizado = TRUE`,
      [ceremoniaId, sesionId],
    ),
  ]);
  const conteo = (resultado) => {
    const registrados = resultado.rows[0].registrados;
    const ingresaron = resultado.rows[0].ingresaron;
    return { registrados, ingresaron, pendientes: registrados - ingresaron };
  };
  return {
    graduandos: conteo(graduandos),
    invitados: conteo(invitados),
  };
}

export async function obtenerEstadisticasControlIngreso(req, res) {
  const sesionId = await validarSesionControl(req, res);
  if (!sesionId) return;
  try {
    return res.json(await obtenerEstadisticasControl(pool, req.params.id, sesionId));
  } catch (error) {
    return responderError(res, error, 'No se pudieron consultar las estadísticas de ingreso.');
  }
}

export async function buscarGraduandosControlIngreso(req, res) {
  const sesionId = await validarSesionControl(req, res);
  if (!sesionId) return;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (!search) return res.status(400).json({ mensaje: 'Ingresa un nombre o documento para buscar.' });
  try {
    const resultado = await pool.query(
      `SELECT g.id_graduando::text AS id
       FROM public.graduando g
       WHERE g.id_ceremonia = $1
         AND g.id_sesion = $2
         AND g.estado = TRUE
         AND (
           g.nombres ILIKE $3
           OR g.apellidos ILIKE $3
           OR CONCAT_WS(' ', g.nombres, g.apellidos) ILIKE $3
           OR g.identificacion ILIKE $3
         )
       ORDER BY g.apellidos, g.nombres
       LIMIT 50`,
      [req.params.id, sesionId, `%${search}%`],
    );
    const graduandos = [];
    for (const fila of resultado.rows) {
      graduandos.push(await obtenerGraduando(pool, fila.id));
    }
    return res.json(graduandos);
  } catch (error) {
    return responderError(res, error, 'No fue posible buscar los graduandos para control de ingreso.');
  }
}

export async function buscarInvitadosControlIngreso(req, res) {
  const sesionId = await validarSesionControl(req, res);
  if (!sesionId) return;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (!search) return res.status(400).json({ mensaje: 'Ingresa un nombre o documento para buscar.' });
  try {
    const resultado = await pool.query(
      `SELECT
         i.id_invitado::text AS id,
         i.id_graduando::text AS "graduandoId",
         g.id_ceremonia::text AS "ceremoniaId",
         i.nombre,
         COALESCE(i.identificacion, '') AS documento,
         CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
         COALESCE(i.parentesco, 'Invitado') AS tipo,
         i.telefono,
         i.parentesco,
         CASE WHEN i.autorizado THEN 'Autorizado' ELSE 'Pendiente' END AS autorizacion,
         CASE WHEN EXISTS (
           SELECT 1
           FROM public.control_ingreso ci
           WHERE ci.id_invitado = i.id_invitado
             AND ci.id_sesion = g.id_sesion
             AND ci.ingreso = TRUE
         ) THEN 'Ingresó' ELSE 'Pendiente' END AS "estadoIngreso",
         (
           SELECT TO_CHAR(ci.hora_ingreso, 'FMHH12:MI AM')
           FROM public.control_ingreso ci
           WHERE ci.id_invitado = i.id_invitado
             AND ci.id_sesion = g.id_sesion
             AND ci.ingreso = TRUE
           ORDER BY ci.id_control_ingreso DESC
           LIMIT 1
         ) AS "horaIngreso"
       FROM public.invitado i
       INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
       WHERE g.id_ceremonia = $1
         AND g.id_sesion = $2
         AND g.estado = TRUE
         AND i.autorizado = TRUE
         AND (
           i.nombre ILIKE $3
           OR i.identificacion ILIKE $3
         )
       ORDER BY i.nombre, i.id_invitado
       LIMIT 50`,
      [req.params.id, sesionId, `%${search}%`],
    );
    return res.json(resultado.rows);
  } catch (error) {
    return responderError(res, error, 'No fue posible buscar los invitados para control de ingreso.');
  }
}

export async function listarInvitadosControlIngreso(req, res) {
  const sesionId = await validarSesionControl(req, res);
  if (!sesionId) return;
  try {
    validarId(req.params.graduandoId, 'graduando');
    const graduando = await pool.query(
      `SELECT 1
       FROM public.graduando
       WHERE id_graduando = $1 AND id_ceremonia = $2 AND id_sesion = $3`,
      [req.params.graduandoId, req.params.id, sesionId],
    );
    if (graduando.rowCount === 0) {
      return res.status(404).json({ mensaje: 'El graduando no pertenece a la sesión seleccionada.' });
    }
    const resultado = await pool.query(
      `SELECT
         i.id_invitado::text AS id,
         i.id_graduando::text AS "graduandoId",
         g.id_ceremonia::text AS "ceremoniaId",
         i.nombre,
         COALESCE(i.identificacion, '') AS documento,
         CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
         COALESCE(i.parentesco, 'Invitado') AS tipo,
         i.telefono,
         i.parentesco,
         CASE WHEN i.autorizado THEN 'Autorizado' ELSE 'Pendiente' END AS autorizacion,
         CASE WHEN EXISTS (
           SELECT 1 FROM public.control_ingreso ci
           WHERE ci.id_invitado = i.id_invitado
             AND ci.id_sesion = g.id_sesion
             AND ci.ingreso = TRUE
         ) THEN 'Ingresó' ELSE 'Pendiente' END AS "estadoIngreso",
         (
           SELECT TO_CHAR(ci.hora_ingreso, 'FMHH12:MI AM')
           FROM public.control_ingreso ci
           WHERE ci.id_invitado = i.id_invitado
             AND ci.id_sesion = g.id_sesion
             AND ci.ingreso = TRUE
           ORDER BY ci.id_control_ingreso DESC
           LIMIT 1
         ) AS "horaIngreso"
       FROM public.invitado i
       INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
       WHERE i.id_graduando = $1 AND i.autorizado = TRUE
       ORDER BY i.nombre`,
      [req.params.graduandoId],
    );
    return res.json(resultado.rows);
  } catch (error) {
    return responderError(res, error, 'No se pudieron consultar los invitados autorizados.');
  }
}

export async function registrarIngresoGraduando(req, res) {
  const sesionId = await validarSesionControl(req, res);
  if (!sesionId) return;
  let client;
  let transaccion = false;
  try {
    validarId(req.params.graduandoId, 'graduando');
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const graduando = await client.query(
      `SELECT id_graduando::text AS id
       FROM public.graduando
       WHERE id_graduando = $1
         AND id_ceremonia = $2
         AND id_sesion = $3
         AND estado = TRUE
       FOR UPDATE`,
      [req.params.graduandoId, req.params.id, sesionId],
    );
    const registro = graduando.rows[0];
    if (!registro) throw errorHttp(404, 'El graduando no pertenece a la sesión seleccionada o está inactivo.');

    const ingresoOtroDia = await client.query(
      `SELECT 1
       FROM public.control_ingreso
       WHERE id_graduando = $1 AND ingreso = TRUE AND id_sesion <> $2
       LIMIT 1`,
      [req.params.graduandoId, sesionId],
    );
    if (ingresoOtroDia.rowCount > 0) {
      throw errorHttp(409, 'El ingreso del graduando ya fue registrado en otra sesión.');
    }

    const ingresoExistente = await client.query(
      `SELECT id_control_ingreso, ingreso,
              TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"
       FROM public.control_ingreso
       WHERE id_graduando = $1 AND id_sesion = $2
       ORDER BY id_control_ingreso DESC
       LIMIT 1
       FOR UPDATE`,
      [req.params.graduandoId, sesionId],
    );
    const actual = ingresoExistente.rows[0];
    const yaIngreso = Boolean(actual?.ingreso);
    let horaIngreso = actual?.horaIngreso ?? null;
    if (!yaIngreso && actual) {
      const actualizado = await client.query(
        `UPDATE public.control_ingreso
         SET ingreso = TRUE, hora_ingreso = CURRENT_TIME
         WHERE id_control_ingreso = $1
         RETURNING TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"`,
        [actual.id_control_ingreso],
      );
      horaIngreso = actualizado.rows[0].horaIngreso;
    } else if (!yaIngreso) {
      const insertado = await client.query(
        `INSERT INTO public.control_ingreso (
           id_sesion, id_graduando, ingreso, hora_ingreso
         )
         VALUES ($1, $2, TRUE, CURRENT_TIME)
         RETURNING TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"`,
        [sesionId, req.params.graduandoId],
      );
      horaIngreso = insertado.rows[0].horaIngreso;
    } else {
      const hora = await client.query(
        `SELECT TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"
         FROM public.control_ingreso
         WHERE id_control_ingreso = $1`,
        [actual.id_control_ingreso],
      );
      horaIngreso = hora.rows[0].horaIngreso;
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json({
      yaIngreso,
      mensaje: yaIngreso ? 'El ingreso del graduando ya estaba registrado.' : 'Ingreso del graduando registrado.',
      horaIngreso,
      estadisticas: await obtenerEstadisticasControl(pool, req.params.id, sesionId),
    });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible registrar el ingreso del graduando.');
  } finally {
    client?.release();
  }
}

export async function registrarIngresoInvitado(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'invitado');
    validarId(req.body?.id_sesion, 'sesión');
    const sesionId = req.body.id_sesion;
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const invitadoResultado = await client.query(
      `SELECT
         i.id_invitado::text AS id,
         g.id_ceremonia::text AS "ceremoniaId",
         i.autorizado,
         g.id_sesion::text AS "sesionGraduando"
       FROM public.invitado i
       INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
       WHERE i.id_invitado = $1
       FOR UPDATE OF i, g`,
      [req.params.id],
    );
    const invitado = invitadoResultado.rows[0];
    if (!invitado) throw errorHttp(404, 'El invitado no existe.');
    if (!invitado.autorizado) {
      throw errorHttp(409, 'El invitado no está autorizado para ingresar.');
    }
    if (
      invitado.sesionGraduando !== sesionId
      || !(await validarSesionCeremonia(client, invitado.ceremoniaId, sesionId))
    ) {
      throw errorHttp(400, 'El invitado no pertenece a la sesión seleccionada.');
    }
    const ingresoOtroDia = await client.query(
      `SELECT 1
       FROM public.control_ingreso
       WHERE id_invitado = $1 AND ingreso = TRUE AND id_sesion <> $2
       LIMIT 1`,
      [req.params.id, sesionId],
    );
    if (ingresoOtroDia.rowCount > 0) {
      throw errorHttp(409, 'El ingreso del invitado ya fue registrado en otra sesión.');
    }

    const ingresoExistente = await client.query(
      `SELECT id_control_ingreso, ingreso,
              TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"
       FROM public.control_ingreso
       WHERE id_invitado = $1 AND id_sesion = $2
       ORDER BY id_control_ingreso DESC
       LIMIT 1
       FOR UPDATE`,
      [req.params.id, sesionId],
    );
    const actual = ingresoExistente.rows[0];
    const yaIngreso = Boolean(actual?.ingreso);
    let horaIngreso = actual?.horaIngreso ?? null;
    if (!yaIngreso && actual) {
      const actualizado = await client.query(
        `UPDATE public.control_ingreso
         SET ingreso = TRUE, hora_ingreso = CURRENT_TIME
         WHERE id_control_ingreso = $1
         RETURNING TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"`,
        [actual.id_control_ingreso],
      );
      horaIngreso = actualizado.rows[0].horaIngreso;
    } else if (!yaIngreso) {
      const insertado = await client.query(
        `INSERT INTO public.control_ingreso (
           id_sesion, id_invitado, ingreso, hora_ingreso
         )
         VALUES ($1, $2, TRUE, CURRENT_TIME)
         RETURNING TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"`,
        [sesionId, req.params.id],
      );
      horaIngreso = insertado.rows[0].horaIngreso;
    } else {
      const hora = await client.query(
        `SELECT TO_CHAR(hora_ingreso, 'FMHH12:MI AM') AS "horaIngreso"
         FROM public.control_ingreso
         WHERE id_control_ingreso = $1`,
        [actual.id_control_ingreso],
      );
      horaIngreso = hora.rows[0].horaIngreso;
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json({
      yaIngreso,
      mensaje: yaIngreso ? 'El ingreso del invitado ya estaba registrado.' : 'Ingreso del invitado registrado.',
      horaIngreso,
      estadisticas: await obtenerEstadisticasControl(pool, invitado.ceremoniaId, sesionId),
    });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible registrar el ingreso del invitado.');
  } finally {
    client?.release();
  }
}

export async function iniciarSesionGraduando(req, res) {
  try {
    const documento = texto(req.body?.documento, 40, 'El documento', true);
    const codigoEstudiantil = texto(req.body?.codigoEstudiantil, 40, 'El código estudiantil', true);
    const resultado = await pool.query(
      `SELECT
         g.id_graduando::text AS id,
         g.id_ceremonia::text AS "ceremoniaId",
         g.nombres,
         g.apellidos,
         g.identificacion AS documento,
         g.codigo_estudiantil AS "codigoEstudiantil",
         COALESCE(
           STRING_AGG(DISTINCT p.nombre, ', ' ORDER BY p.nombre),
           'Sin programa'
         ) AS programa,
         c.max_invitados_por_graduando AS "maxInvitadosPorGraduando",
         COUNT(DISTINCT i.id_invitado)::integer AS "invitadosRegistrados"
       FROM public.graduando g
       INNER JOIN public.ceremonia_grado c ON c.id_ceremonia = g.id_ceremonia
       LEFT JOIN public.graduando_programa gp ON gp.id_graduando = g.id_graduando
       LEFT JOIN public.programa p ON p.id_programa = gp.id_programa
       LEFT JOIN public.invitado i ON i.id_graduando = g.id_graduando
       WHERE COALESCE(
           NULLIF(REGEXP_REPLACE(g.identificacion, '[^0-9]', '', 'g'), ''),
           LOWER(BTRIM(g.identificacion))
         ) = $1
         AND LOWER(BTRIM(g.codigo_estudiantil)) = LOWER($2)
         AND g.estado = TRUE
         AND c.estado NOT IN ('Finalizada', 'Cancelada')
       GROUP BY g.id_graduando, c.max_invitados_por_graduando, c.fecha
       ORDER BY c.fecha DESC
       LIMIT 2`,
      [documentoCanonico(documento), codigoEstudiantil],
    );
    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'El documento o código estudiantil no coincide con una ceremonia activa.' });
    }
    if (resultado.rowCount > 1) {
      return res.status(409).json({ mensaje: 'El graduando aparece en más de una ceremonia activa.' });
    }
    return res.json(resultado.rows[0]);
  } catch (error) {
    return responderError(res, error, 'No fue posible iniciar la sesión del graduando.');
  }
}
