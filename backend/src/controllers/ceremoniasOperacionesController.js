import { randomUUID } from 'node:crypto';
import pool from '../db.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ESTADOS_CEREMONIA = new Set(['Programada', 'En curso', 'Finalizada', 'Cancelada']);
const ESTADOS_SESION = new Set(['Pendiente', 'En curso', 'Finalizada']);
const ESTADOS_AUTORIZACION = new Set(['Autorizado', 'Pendiente']);
const MAX_FILAS_IMPORTACION = 1000;

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
  if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
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
  if ((horaInicio && !horaFin) || (!horaInicio && horaFin) || (horaInicio && horaInicio >= horaFin)) {
    throw errorHttp(400, 'Completa un rango de horas válido.');
  }
  return { horaInicio, horaFin };
}

async function obtenerCeremonia(executor, id, bloquear = false) {
  const resultado = await executor.query(
    `SELECT id::text AS id, estado,
            max_invitados_por_graduando AS "maxInvitadosPorGraduando",
            cupo_invitados AS "cupoInvitados"
     FROM public.sgme_ceremonia
     WHERE id = $1
     ${bloquear ? 'FOR UPDATE' : ''}`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function validarSesionCeremonia(executor, ceremoniaId, sesionId) {
  const resultado = await executor.query(
    `SELECT 1
     FROM public.sgme_ceremonia_sesion
     WHERE id = $1 AND id_ceremonia = $2`,
    [sesionId, ceremoniaId],
  );
  return resultado.rowCount > 0;
}

async function obtenerSesion(executor, id) {
  const resultado = await executor.query(
    `SELECT
       s.id::text AS id,
       s.id_ceremonia::text AS "ceremoniaId",
       s.numero_sesion AS "numeroSesion",
       s.nombre,
       s.estado,
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
        FROM public.sgme_ceremonia_graduando g
        WHERE g.id_sesion = s.id) AS "graduandosCount",
       (SELECT COUNT(*)::integer
        FROM public.sgme_ceremonia_invitado i
        INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
        WHERE g.id_sesion = s.id) AS "invitadosCount"
     FROM public.sgme_ceremonia_sesion s
     LEFT JOIN public.sgme_ceremonia_sesion_programa sp ON sp.id_sesion = s.id
     LEFT JOIN public.programa p ON p.id_programa = sp.id_programa
     WHERE s.id = $1
     GROUP BY s.id`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function obtenerGraduando(executor, id) {
  const resultado = await executor.query(
    `SELECT
       g.id::text AS id,
       g.id_ceremonia::text AS "ceremoniaId",
       g.id_sesion::text AS "sesionId",
       g.nombres,
       g.apellidos,
       g.documento,
       g.telefono,
       g.correo,
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
       COUNT(DISTINCT i.id)::integer AS "invitadosCount",
       g.requisitos_cumplidos AS "requisitosCumplidos",
       g.estado,
       CASE WHEN g.ingreso_at IS NULL THEN 'Pendiente' ELSE 'Ingresó' END AS "estadoIngreso",
       TO_CHAR(g.ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
     FROM public.sgme_ceremonia_graduando g
     LEFT JOIN public.sgme_ceremonia_sesion s ON s.id = g.id_sesion
     LEFT JOIN public.sgme_ceremonia_graduando_programa gp ON gp.id_graduando = g.id
     LEFT JOIN public.programa p ON p.id_programa = gp.id_programa
     LEFT JOIN public.sgme_ceremonia_invitado i ON i.id_graduando = g.id
     WHERE g.id = $1
     GROUP BY g.id, s.nombre`,
    [id],
  );
  return resultado.rows[0] ?? null;
}

async function obtenerInvitado(executor, id) {
  const resultado = await executor.query(
    `SELECT
       i.id::text AS id,
       i.id_graduando::text AS "graduandoId",
       i.id_ceremonia::text AS "ceremoniaId",
       i.nombre,
       COALESCE(i.documento, '') AS documento,
       CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
       COALESCE(i.parentesco, 'Invitado') AS tipo,
       i.telefono,
       i.parentesco,
       i.autorizacion,
       CASE WHEN i.ingreso_at IS NULL THEN 'Pendiente' ELSE 'Ingresó' END AS "estadoIngreso",
       TO_CHAR(i.ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
     FROM public.sgme_ceremonia_invitado i
     INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
     WHERE i.id = $1`,
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
  if (typeof sesionId !== 'string' || !UUID_REGEX.test(sesionId)) {
    throw errorHttp(400, 'La sesión seleccionada no es válida.');
  }
  const resultado = await executor.query(
    `SELECT 1
     FROM public.sgme_ceremonia_sesion s
     INNER JOIN public.sgme_ceremonia_sesion_programa sp ON sp.id_sesion = s.id
     WHERE s.id = $1
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
  if (idSesion !== null && (typeof idSesion !== 'string' || !UUID_REGEX.test(idSesion))) {
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
     FROM public.sgme_ceremonia_graduando
     WHERE id_ceremonia = $1
       AND ($3::uuid IS NULL OR id <> $3::uuid)
       AND COALESCE(
         NULLIF(REGEXP_REPLACE(documento, '[^0-9]', '', 'g'), ''),
         LOWER(BTRIM(documento))
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
    const nombre = texto(req.body?.nombre, 180, 'El nombre de la sesión', true);
    const estado = req.body?.estado ?? 'Pendiente';
    if (!ESTADOS_SESION.has(estado)) {
      throw errorHttp(400, 'El estado de la sesión no es válido.');
    }
    const { horaInicio, horaFin } = validarHorario(req.body ?? {});

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await obtenerCeremonia(client, req.params.id, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');

    const numero = await client.query(
      `SELECT COALESCE(MAX(numero_sesion), 0)::integer + 1 AS numero
       FROM public.sgme_ceremonia_sesion
       WHERE id_ceremonia = $1`,
      [req.params.id],
    );
    const id = randomUUID();
    await client.query(
      `INSERT INTO public.sgme_ceremonia_sesion (
         id, id_ceremonia, numero_sesion, nombre, estado, hora_inicio, hora_fin
       )
       VALUES ($1, $2, $3, $4, $5, $6::time, $7::time)`,
      [id, req.params.id, numero.rows[0].numero, nombre, estado, horaInicio, horaFin],
    );
    await client.query('COMMIT');
    transaccion = false;
    return res.status(201).json(await obtenerSesion(pool, id));
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
    const estado = req.body?.estado;
    if (!ESTADOS_SESION.has(estado)) {
      throw errorHttp(400, 'El estado de la sesión no es válido.');
    }
    const { horaInicio, horaFin } = validarHorario(req.body ?? {});

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const sesionResultado = await client.query(
      `SELECT id::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.sgme_ceremonia_sesion
       WHERE id = $1
       FOR UPDATE`,
      [req.params.id],
    );
    const sesionActual = sesionResultado.rows[0];
    if (!sesionActual) throw errorHttp(404, 'La sesión no existe.');

    const programaIds = await resolverProgramasPorNombre(client, req.body?.programas);
    if (programaIds.length === 0) {
      const graduandosAsignados = await client.query(
        'SELECT 1 FROM public.sgme_ceremonia_graduando WHERE id_sesion = $1 LIMIT 1',
        [req.params.id],
      );
      if (graduandosAsignados.rowCount > 0) {
        throw errorHttp(409, 'No puedes quitar todos los programas mientras haya graduandos asignados a esta sesión.');
      }
    } else {
      const incompatibles = await client.query(
        `SELECT 1
         FROM public.sgme_ceremonia_graduando g
         INNER JOIN public.sgme_ceremonia_graduando_programa gp ON gp.id_graduando = g.id
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
      `UPDATE public.sgme_ceremonia_sesion
       SET nombre = $2, estado = $3, hora_inicio = $4::time, hora_fin = $5::time,
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, nombre, estado, horaInicio, horaFin],
    );
    await client.query(
      'DELETE FROM public.sgme_ceremonia_sesion_programa WHERE id_sesion = $1',
      [req.params.id],
    );
    for (const programaId of programaIds) {
      await client.query(
        `INSERT INTO public.sgme_ceremonia_sesion_programa (id_sesion, id_programa)
         VALUES ($1, $2)`,
        [req.params.id, programaId],
      );
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json(await obtenerSesion(pool, req.params.id));
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error, 'No fue posible actualizar la sesión.');
  } finally {
    client?.release();
  }
}

export async function actualizarEstadoCeremonia(req, res) {
  let client;
  let transaccion = false;
  try {
    validarId(req.params.id, 'ceremonia');
    const { estado, motivo } = req.body ?? {};
    if (!ESTADOS_CEREMONIA.has(estado)) {
      throw errorHttp(400, 'El estado de la ceremonia no es válido.');
    }
    const motivoNormalizado = motivo === undefined
      ? null
      : texto(motivo, 500, 'El motivo');

    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await obtenerCeremonia(client, req.params.id, true);
    if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
    await client.query(
      `UPDATE public.sgme_ceremonia
       SET estado = $2,
           motivo_estado = COALESCE($3, motivo_estado),
           updated_at = NOW()
       WHERE id = $1`,
      [req.params.id, estado, motivoNormalizado],
    );
    let sesionesFinalizadas = 0;
    if (estado === 'Finalizada') {
      const resultado = await client.query(
        `UPDATE public.sgme_ceremonia_sesion
         SET estado = 'Finalizada', updated_at = NOW()
         WHERE id_ceremonia = $1 AND estado <> 'Finalizada'`,
        [req.params.id],
      );
      sesionesFinalizadas = resultado.rowCount;
    }
    await client.query('COMMIT');
    transaccion = false;
    return res.json({ id: req.params.id, estado, sesionesFinalizadas });
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
      `UPDATE public.sgme_ceremonia
       SET max_invitados_por_graduando = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id::text AS id, max_invitados_por_graduando AS "maxInvitadosPorGraduando"`,
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
      `UPDATE public.sgme_ceremonia
       SET cupo_invitados = $2, updated_at = NOW()
       WHERE id = $1
       RETURNING id::text AS id, cupo_invitados AS "cupoInvitados"`,
      [req.params.id, cupo],
    );
    if (resultado.rowCount === 0) return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    const conteo = await pool.query(
      `SELECT COUNT(*)::integer AS "invitadosRegistrados"
       FROM public.sgme_ceremonia_invitado
       WHERE id_ceremonia = $1`,
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

    const id = randomUUID();
    await client.query(
      `INSERT INTO public.sgme_ceremonia_graduando (
         id, id_ceremonia, id_sesion, nombres, apellidos, documento, telefono,
         correo, codigo_estudiantil, talla_toga, estado, requisitos_cumplidos
       )
       VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''),
               NULLIF($9, ''), NULLIF($10, ''), $11, $12)`,
      [
        id, req.params.id, datos.idSesion, datos.nombres, datos.apellidos,
        datos.documento, datos.telefono, datos.correo, datos.codigoEstudiantil,
        datos.tallaToga, datos.estado, datos.requisitosCumplidos,
      ],
    );
    for (const programaId of programaIds) {
      await client.query(
        `INSERT INTO public.sgme_ceremonia_graduando_programa (id_graduando, id_programa)
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
      `SELECT id::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.sgme_ceremonia_graduando
       WHERE id = $1
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
      `UPDATE public.sgme_ceremonia_graduando
       SET id_sesion = $2, nombres = $3, apellidos = $4, documento = $5,
           telefono = NULLIF($6, ''), correo = NULLIF($7, ''),
           codigo_estudiantil = NULLIF($8, ''), talla_toga = NULLIF($9, ''),
           estado = $10, requisitos_cumplidos = $11, updated_at = NOW()
       WHERE id = $1`,
      [
        req.params.id, datos.idSesion, datos.nombres, datos.apellidos,
        datos.documento, datos.telefono, datos.correo, datos.codigoEstudiantil,
        datos.tallaToga, datos.estado, datos.requisitosCumplidos,
      ],
    );
    await client.query(
      'DELETE FROM public.sgme_ceremonia_graduando_programa WHERE id_graduando = $1',
      [req.params.id],
    );
    for (const programaId of programaIds) {
      await client.query(
        `INSERT INTO public.sgme_ceremonia_graduando_programa (id_graduando, id_programa)
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
      `SELECT g.id::text AS id
       FROM public.sgme_ceremonia_graduando g
       INNER JOIN public.sgme_ceremonia c ON c.id = g.id_ceremonia
       WHERE COALESCE(
         NULLIF(REGEXP_REPLACE(g.documento, '[^0-9]', '', 'g'), ''),
         LOWER(BTRIM(g.documento))
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
    `SELECT s.numero_sesion, s.id::text AS id,
            COALESCE(
              ARRAY_AGG(sp.id_programa)
                FILTER (WHERE sp.id_programa IS NOT NULL),
              ARRAY[]::integer[]
            ) AS "programaIds"
     FROM public.sgme_ceremonia_sesion s
     LEFT JOIN public.sgme_ceremonia_sesion_programa sp ON sp.id_sesion = s.id
     WHERE s.id_ceremonia = $1
     GROUP BY s.id`,
    [ceremoniaId],
  );
  const sesionesPorNumero = new Map(
    sesiones.rows.map((sesion) => [String(sesion.numero_sesion), sesion]),
  );
  const existentes = await executor.query(
    `SELECT DISTINCT COALESCE(
       NULLIF(REGEXP_REPLACE(documento, '[^0-9]', '', 'g'), ''),
       LOWER(BTRIM(documento))
     ) AS documento
     FROM public.sgme_ceremonia_graduando
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
      const graduandoId = randomUUID();
      await client.query(
        `INSERT INTO public.sgme_ceremonia_graduando (
           id, id_ceremonia, id_sesion, nombres, apellidos, documento, telefono,
           correo, codigo_estudiantil, talla_toga
         )
         VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''),
                 NULLIF($9, ''), NULLIF($10, ''))`,
        [
          graduandoId, req.params.id, fila.idSesion, fila.nombres, fila.apellidos,
          fila.documento, fila.telefono, fila.correo, fila.codigoEstudiantil,
          fila.tallaToga,
        ],
      );
      await client.query(
        `INSERT INTO public.sgme_ceremonia_graduando_programa (id_graduando, id_programa)
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
       i.id::text AS id,
       i.id_graduando::text AS "graduandoId",
       i.id_ceremonia::text AS "ceremoniaId",
       i.nombre,
       COALESCE(i.documento, '') AS documento,
       CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
       COALESCE(i.parentesco, 'Invitado') AS tipo,
       i.telefono,
       i.parentesco,
       i.autorizacion,
       CASE WHEN i.ingreso_at IS NULL THEN 'Pendiente' ELSE 'Ingresó' END AS "estadoIngreso",
       TO_CHAR(i.ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
     FROM public.sgme_ceremonia_invitado i
     INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
     WHERE i.id_ceremonia = $1 ${condicionGraduando}
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
        'SELECT 1 FROM public.sgme_ceremonia_graduando WHERE id = $1 AND id_ceremonia = $2',
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
  const autorizacion = body.autorizacion ?? 'Autorizado';
  if (!ESTADOS_AUTORIZACION.has(autorizacion)) {
    throw errorHttp(400, 'El estado de autorización del invitado no es válido.');
  }
  return {
    nombre: texto(body.nombre, 180, 'El nombre del invitado', true),
    documento: texto(body.documento, 40, 'El documento'),
    telefono: texto(body.telefono, 40, 'El teléfono'),
    parentesco: texto(body.parentesco ?? body.tipo, 80, 'El parentesco o tipo'),
    autorizacion,
  };
}

async function crearInvitado(client, ceremoniaId, graduandoId, datos) {
  if (datos.documento) {
    const duplicado = await client.query(
      `SELECT 1
       FROM public.sgme_ceremonia_invitado
       WHERE id_graduando = $1
         AND COALESCE(
           NULLIF(REGEXP_REPLACE(documento, '[^0-9]', '', 'g'), ''),
           LOWER(BTRIM(documento))
         ) = $2
       LIMIT 1`,
      [graduandoId, documentoCanonico(datos.documento)],
    );
    if (duplicado.rowCount > 0) {
      throw errorHttp(409, 'El documento ya está registrado para este graduando.');
    }
  }
  const id = randomUUID();
  await client.query(
    `INSERT INTO public.sgme_ceremonia_invitado (
       id, id_ceremonia, id_graduando, nombre, documento, telefono, parentesco, autorizacion
     )
     VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), $8)`,
    [
      id, ceremoniaId, graduandoId, datos.nombre, datos.documento,
      datos.telefono, datos.parentesco, datos.autorizacion,
    ],
  );
  return id;
}

async function validarCupoInvitados(client, ceremoniaId, graduandoId, cantidadNueva) {
  const ceremonia = await obtenerCeremonia(client, ceremoniaId, true);
  if (!ceremonia) throw errorHttp(404, 'La ceremonia no existe.');
  const conteos = await client.query(
    `SELECT
       (SELECT COUNT(*)::integer
        FROM public.sgme_ceremonia_invitado
        WHERE id_graduando = $2) AS "invitadosGraduando",
       (SELECT COUNT(*)::integer
        FROM public.sgme_ceremonia_invitado
        WHERE id_ceremonia = $1) AS "invitadosCeremonia"`,
    [ceremoniaId, graduandoId],
  );
  const { invitadosGraduando, invitadosCeremonia } = conteos.rows[0];
  if (invitadosGraduando + cantidadNueva > ceremonia.maxInvitadosPorGraduando) {
    throw errorHttp(
      409,
      `Este graduando ya alcanzó el límite de ${ceremonia.maxInvitadosPorGraduando} invitados.`,
    );
  }
  if (
    ceremonia.cupoInvitados !== null
    && invitadosCeremonia + cantidadNueva > ceremonia.cupoInvitados
  ) {
    throw errorHttp(409, 'Se alcanzó el cupo total de invitados de la ceremonia.');
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
      `SELECT id::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.sgme_ceremonia_graduando
       WHERE id = $1
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
      `SELECT id::text AS id, id_ceremonia::text AS "ceremoniaId"
       FROM public.sgme_ceremonia_graduando
       WHERE id = $1
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
    const datos = validarDatosInvitado(req.body ?? {});
    if (datos.documento) {
      const duplicado = await pool.query(
        `SELECT 1
         FROM public.sgme_ceremonia_invitado actual
         INNER JOIN public.sgme_ceremonia_invitado otro
           ON otro.id_graduando = actual.id_graduando
          AND otro.id <> actual.id
         WHERE actual.id = $1
           AND COALESCE(
             NULLIF(REGEXP_REPLACE(otro.documento, '[^0-9]', '', 'g'), ''),
             LOWER(BTRIM(otro.documento))
           ) = $2
         LIMIT 1`,
        [req.params.id, documentoCanonico(datos.documento)],
      );
      if (duplicado.rowCount > 0) {
        throw errorHttp(409, 'El documento ya está registrado para este graduando.');
      }
    }
    const resultado = await pool.query(
      `UPDATE public.sgme_ceremonia_invitado
       SET nombre = $2, documento = NULLIF($3, ''), telefono = NULLIF($4, ''),
           parentesco = NULLIF($5, ''), autorizacion = $6, updated_at = NOW()
       WHERE id = $1`,
      [
        req.params.id, datos.nombre, datos.documento, datos.telefono,
        datos.parentesco, datos.autorizacion,
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
                WHERE ingreso_at IS NOT NULL AND ingreso_sesion_id = $2
              )::integer AS ingresaron
       FROM public.sgme_ceremonia_graduando
       WHERE id_ceremonia = $1 AND id_sesion = $2 AND estado = TRUE`,
      [ceremoniaId, sesionId],
    ),
    executor.query(
      `SELECT COUNT(*)::integer AS registrados,
              COUNT(*) FILTER (
                WHERE i.ingreso_at IS NOT NULL AND i.ingreso_sesion_id = $2
              )::integer AS ingresaron
       FROM public.sgme_ceremonia_invitado i
       INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
       WHERE i.id_ceremonia = $1
         AND g.id_sesion = $2
         AND g.estado = TRUE
         AND i.autorizacion = 'Autorizado'`,
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
      `SELECT g.id::text AS id
       FROM public.sgme_ceremonia_graduando g
       WHERE g.id_ceremonia = $1
         AND g.id_sesion = $2
         AND g.estado = TRUE
         AND (
           g.nombres ILIKE $3
           OR g.apellidos ILIKE $3
           OR CONCAT_WS(' ', g.nombres, g.apellidos) ILIKE $3
           OR g.documento ILIKE $3
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

export async function listarInvitadosControlIngreso(req, res) {
  const sesionId = await validarSesionControl(req, res);
  if (!sesionId) return;
  try {
    validarId(req.params.graduandoId, 'graduando');
    const graduando = await pool.query(
      `SELECT 1
       FROM public.sgme_ceremonia_graduando
       WHERE id = $1 AND id_ceremonia = $2 AND id_sesion = $3`,
      [req.params.graduandoId, req.params.id, sesionId],
    );
    if (graduando.rowCount === 0) {
      return res.status(404).json({ mensaje: 'El graduando no pertenece a la sesión seleccionada.' });
    }
    const resultado = await pool.query(
      `SELECT
         i.id::text AS id,
         i.id_graduando::text AS "graduandoId",
         i.id_ceremonia::text AS "ceremoniaId",
         i.nombre,
         COALESCE(i.documento, '') AS documento,
         CONCAT_WS(' ', g.nombres, g.apellidos) AS "graduandoNombre",
         COALESCE(i.parentesco, 'Invitado') AS tipo,
         i.telefono,
         i.parentesco,
         i.autorizacion,
         CASE WHEN i.ingreso_at IS NULL THEN 'Pendiente' ELSE 'Ingresó' END AS "estadoIngreso",
         TO_CHAR(i.ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
       FROM public.sgme_ceremonia_invitado i
       INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
       WHERE i.id_graduando = $1 AND i.autorizacion = 'Autorizado'
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
      `SELECT id::text AS id, ingreso_at, ingreso_sesion_id::text AS "ingresoSesionId"
       FROM public.sgme_ceremonia_graduando
       WHERE id = $1
         AND id_ceremonia = $2
         AND id_sesion = $3
         AND estado = TRUE
       FOR UPDATE`,
      [req.params.graduandoId, req.params.id, sesionId],
    );
    const registro = graduando.rows[0];
    if (!registro) throw errorHttp(404, 'El graduando no pertenece a la sesión seleccionada o está inactivo.');
    if (registro.ingreso_at && registro.ingresoSesionId !== sesionId) {
      throw errorHttp(409, 'El ingreso del graduando ya fue registrado en otra sesión.');
    }
    const yaIngreso = Boolean(registro.ingreso_at);
    let horaIngreso = null;
    if (!yaIngreso) {
      const actualizado = await client.query(
        `UPDATE public.sgme_ceremonia_graduando
         SET ingreso_at = NOW(), ingreso_sesion_id = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING TO_CHAR(ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"`,
        [req.params.graduandoId, sesionId],
      );
      horaIngreso = actualizado.rows[0].horaIngreso;
    } else {
      const hora = await client.query(
        `SELECT TO_CHAR(ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
         FROM public.sgme_ceremonia_graduando WHERE id = $1`,
        [req.params.graduandoId],
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
         i.id::text AS id,
         i.id_ceremonia::text AS "ceremoniaId",
         i.autorizacion,
         i.ingreso_at,
         i.ingreso_sesion_id::text AS "ingresoSesionId",
         g.id_sesion::text AS "sesionGraduando"
       FROM public.sgme_ceremonia_invitado i
       INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
       WHERE i.id = $1
       FOR UPDATE OF i`,
      [req.params.id],
    );
    const invitado = invitadoResultado.rows[0];
    if (!invitado) throw errorHttp(404, 'El invitado no existe.');
    if (invitado.autorizacion !== 'Autorizado') {
      throw errorHttp(409, 'El invitado no está autorizado para ingresar.');
    }
    if (
      invitado.sesionGraduando !== sesionId
      || !(await validarSesionCeremonia(client, invitado.ceremoniaId, sesionId))
    ) {
      throw errorHttp(400, 'El invitado no pertenece a la sesión seleccionada.');
    }
    if (invitado.ingreso_at && invitado.ingresoSesionId !== sesionId) {
      throw errorHttp(409, 'El ingreso del invitado ya fue registrado en otra sesión.');
    }
    const yaIngreso = Boolean(invitado.ingreso_at);
    let horaIngreso = null;
    if (!yaIngreso) {
      const actualizado = await client.query(
        `UPDATE public.sgme_ceremonia_invitado
         SET ingreso_at = NOW(), ingreso_sesion_id = $2, updated_at = NOW()
         WHERE id = $1
         RETURNING TO_CHAR(ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"`,
        [req.params.id, sesionId],
      );
      horaIngreso = actualizado.rows[0].horaIngreso;
    } else {
      const hora = await client.query(
        `SELECT TO_CHAR(ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
         FROM public.sgme_ceremonia_invitado WHERE id = $1`,
        [req.params.id],
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
         g.id::text AS id,
         g.id_ceremonia::text AS "ceremoniaId",
         g.nombres,
         g.apellidos,
         g.documento,
         g.codigo_estudiantil AS "codigoEstudiantil",
         COALESCE(
           STRING_AGG(DISTINCT p.nombre, ', ' ORDER BY p.nombre),
           'Sin programa'
         ) AS programa,
         c.max_invitados_por_graduando AS "maxInvitadosPorGraduando",
         COUNT(DISTINCT i.id)::integer AS "invitadosRegistrados"
       FROM public.sgme_ceremonia_graduando g
       INNER JOIN public.sgme_ceremonia c ON c.id = g.id_ceremonia
       LEFT JOIN public.sgme_ceremonia_graduando_programa gp ON gp.id_graduando = g.id
       LEFT JOIN public.programa p ON p.id_programa = gp.id_programa
       LEFT JOIN public.sgme_ceremonia_invitado i ON i.id_graduando = g.id
       WHERE COALESCE(
           NULLIF(REGEXP_REPLACE(g.documento, '[^0-9]', '', 'g'), ''),
           LOWER(BTRIM(g.documento))
         ) = $1
         AND LOWER(BTRIM(g.codigo_estudiantil)) = LOWER($2)
         AND g.estado = TRUE
         AND c.estado NOT IN ('Finalizada', 'Cancelada')
       GROUP BY g.id, c.max_invitados_por_graduando
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
