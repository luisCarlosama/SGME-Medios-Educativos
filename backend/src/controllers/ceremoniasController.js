import { createHash, randomUUID } from 'node:crypto';
import pool from '../db.js';
import { obtenerPoolInstitucional } from '../dbInstitucional.js';
import { consultarGraduandosInstitucionales } from '../services/institucionalService.js';

const ESTADOS_CEREMONIA = new Set([
  'Programada',
  'En curso',
  'Finalizada',
  'Cancelada',
]);

const ID_INTEGER_REGEX = /^[1-9]\d*$/;
const MAX_FOTOS_CEREMONIA = 4;
const MAX_FOTO_BYTES = 3 * 1024 * 1024;
const TIPOS_FOTO = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

function versionFoto(contenido) {
  return createHash('sha256').update(contenido).digest('hex');
}

const SELECT_CEREMONIAS = `
  SELECT
    c.id_ceremonia::text AS id,
    c.codigo_ceremonia AS codigo,
    c.nombre,
    c.periodo_grado AS "periodoGrado",
    TO_CHAR(c.fecha, 'DD/MM/YYYY') AS fecha,
    TO_CHAR(c.fecha, 'YYYY-MM-DD') AS "fechaISO",
    e.nombre AS lugar,
    campus.nombre AS campus,
    COUNT(DISTINCT s.id_sesion)::integer AS sesiones,
    (
      SELECT COUNT(*)::integer
      FROM public.graduando g
      WHERE g.id_ceremonia = c.id_ceremonia
    ) AS graduandos,
    (
      SELECT COUNT(*)::integer
      FROM public.invitado i
      INNER JOIN public.graduando g
        ON g.id_graduando = i.id_graduando
      WHERE g.id_ceremonia = c.id_ceremonia
    ) AS invitados,
    (
      SELECT STRING_AGG(DISTINCT p.nombre, ', ' ORDER BY p.nombre)
      FROM public.graduando g
      INNER JOIN public.graduando_programa gp
        ON gp.id_graduando = g.id_graduando
      INNER JOIN public.programa p
        ON p.id_programa = gp.id_programa
      WHERE g.id_ceremonia = c.id_ceremonia
    ) AS programas,
    c.estado,
    c.max_invitados_por_graduando AS "maxInvitadosPorGraduando",
    c.cupo_invitados AS "cupoInvitados"
  FROM public.ceremonia_grado c
  INNER JOIN public.espacio e
    ON e.id_espacio = c.id_espacio
  INNER JOIN public.campus campus
    ON campus.id_campus = e.id_campus
  LEFT JOIN public.sesion s
    ON s.id_ceremonia = c.id_ceremonia
`;

export async function listarGraduandosInstitucionales(req, res) {
  const direccionesLocales = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  if (
    process.env.INSTITUCIONAL_PREVIEW_LOCAL !== 'true'
    || process.env.NODE_ENV === 'production'
    || !direccionesLocales.has(req.socket.remoteAddress)
  ) {
    return res.status(403).json({ mensaje: 'La consulta de prueba solo está disponible localmente.' });
  }

  const pagina = String(req.query.pagina ?? '1');
  if (!/^[1-9]\d{0,4}$/.test(pagina)) {
    return res.status(400).json({ mensaje: 'La página solicitada no es válida.' });
  }

  try {
    const resultado = await consultarGraduandosInstitucionales(
      obtenerPoolInstitucional(),
      process.env.INSTITUCIONAL_DB_SCHEMA || 'public',
      Number(pagina),
    );
    res.set('Cache-Control', 'no-store');
    return res.json(resultado);
  } catch (error) {
    console.error('Error al consultar graduandos institucionales:', error.message);
    return res.status(503).json({ mensaje: 'No fue posible consultar la base institucional de prueba.' });
  }
}

function fechaValida(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }

  const fechaParseada = new Date(`${fecha}T00:00:00.000Z`);
  return !Number.isNaN(fechaParseada.getTime())
    && fechaParseada.toISOString().slice(0, 10) === fecha;
}

function obtenerCeremonia(id) {
  return pool.query(
    `${SELECT_CEREMONIAS}
      WHERE c.id_ceremonia = $1
      GROUP BY c.id_ceremonia, e.nombre, campus.nombre`,
    [id]
  );
}

function validarFoto(foto) {
  if (!foto || typeof foto !== 'object') {
    return { error: 'Una de las fotografías no tiene un formato válido.' };
  }

  const mimeType = foto.mimeType === 'image/jpg' ? 'image/jpeg' : foto.mimeType;
  const { base64 } = foto;
  if (typeof mimeType !== 'string' || !TIPOS_FOTO.has(mimeType)) {
    return { error: 'El tipo de imagen no está permitido.' };
  }

  if (
    typeof base64 !== 'string'
    || base64.length === 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  ) {
    return { error: 'Una de las fotografías no contiene datos válidos.' };
  }

  const contenido = Buffer.from(base64, 'base64');
  if (contenido.length === 0 || contenido.length > MAX_FOTO_BYTES) {
    return { error: 'Cada fotografía debe ocupar como máximo 3 MB.' };
  }

  const firmaValida = {
    'image/png': () => contenido.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    'image/jpeg': () => contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff,
    'image/gif': () => ['GIF87a', 'GIF89a'].includes(contenido.toString('ascii', 0, 6)),
    'image/webp': () => contenido.toString('ascii', 0, 4) === 'RIFF'
      && contenido.toString('ascii', 8, 12) === 'WEBP',
  }[mimeType]();

  if (!firmaValida || contenido.toString('base64') !== base64) {
    return { error: 'El contenido de una fotografía no coincide con su formato.' };
  }

  return { mimeType, base64, tamanoBytes: contenido.length };
}

function detectarMimeType(contenido) {
  if (contenido.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) return 'image/png';
  if (contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff) return 'image/jpeg';
  if (['GIF87a', 'GIF89a'].includes(contenido.toString('ascii', 0, 6))) return 'image/gif';
  if (
    contenido.toString('ascii', 0, 4) === 'RIFF'
    && contenido.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export async function listarCeremonias(req, res) {
  try {
    const condiciones = [];
    const valores = [];
    const { nombre, fecha, estado } = req.query;

    if (typeof nombre === 'string' && nombre.trim()) {
      valores.push(`%${nombre.trim()}%`);
      condiciones.push(`c.nombre ILIKE $${valores.length}`);
    }

    if (fecha !== undefined) {
      if (!fechaValida(fecha)) {
        return res.status(400).json({ mensaje: 'La fecha indicada no es válida.' });
      }
      valores.push(fecha);
      condiciones.push(`c.fecha = $${valores.length}::date`);
    }

    if (estado !== undefined && estado !== 'Todos') {
      if (!ESTADOS_CEREMONIA.has(estado)) {
        return res.status(400).json({ mensaje: 'El estado indicado no es válido.' });
      }
      valores.push(estado);
      condiciones.push(`c.estado = $${valores.length}`);
    }

    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
    const resultado = await pool.query(
      `${SELECT_CEREMONIAS}
        ${where}
        GROUP BY c.id_ceremonia, e.nombre, campus.nombre
        ORDER BY c.fecha DESC, c.nombre ASC`,
      valores
    );

    return res.json({
      data: resultado.rows,
      total: resultado.rowCount,
    });
  } catch (error) {
    console.error('Error al consultar ceremonias:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar las ceremonias.',
    });
  }
}

export async function obtenerCeremoniaPorId(req, res) {
  const { id } = req.params;
  if (!ID_INTEGER_REGEX.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  try {
    const resultado = await obtenerCeremonia(id);
    if (resultado.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }
    return res.json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al consultar ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No se pudo consultar la ceremonia.',
    });
  }
}

export async function crearCeremonia(req, res) {
  const {
    nombre,
    fecha,
    periodoGrado,
    idEspacio,
    estado = 'Programada',
    maxInvitadosPorGraduando = 2,
  } = req.body ?? {};

  const nombreNormalizado = typeof nombre === 'string' ? nombre.trim() : '';
  const espacioId = Number(idEspacio);

  if (!nombreNormalizado || nombreNormalizado.length > 180) {
    return res.status(400).json({
      mensaje: 'El nombre de la ceremonia es obligatorio y no puede superar 180 caracteres.',
    });
  }

  if (!fechaValida(fecha)) {
    return res.status(400).json({ mensaje: 'La fecha indicada no es válida.' });
  }

  const periodoNormalizado = typeof periodoGrado === 'string' ? periodoGrado.trim() : '';
  if (!periodoNormalizado || periodoNormalizado.length > 40) {
    return res.status(400).json({ mensaje: 'El periodo de grado es obligatorio y no puede superar 40 caracteres.' });
  }

  if (!Number.isInteger(espacioId) || espacioId <= 0) {
    return res.status(400).json({ mensaje: 'El espacio seleccionado no es válido.' });
  }

  if (estado !== 'Programada' || !ESTADOS_CEREMONIA.has(estado)) {
    return res.status(400).json({ mensaje: 'Una nueva ceremonia debe crearse en estado Programada.' });
  }

  if (![2, 3, 4].includes(Number(maxInvitadosPorGraduando))) {
    return res.status(400).json({
      mensaje: 'El máximo de invitados por graduando debe ser 2, 3 o 4.',
    });
  }

  const codigo = `CER-${fecha.slice(0, 4)}-${randomUUID().slice(0, 8).toUpperCase()}`;

  try {
    const insertado = await pool.query(
      `INSERT INTO public.ceremonia_grado (
         id_evento, id_espacio, codigo_ceremonia, nombre, fecha, estado,
         max_invitados_por_graduando, periodo_grado, finalizar_automaticamente
       )
       SELECT NULL, e.id_espacio, $1, $2, $3::date, 'Programada', $4, $6, TRUE
       FROM public.espacio e
       INNER JOIN public.campus campus ON campus.id_campus = e.id_campus
       WHERE e.id_espacio = $5
         AND e.estado = TRUE
         AND e.nombre ILIKE '%auditorio%'
         AND (
           lower(btrim(campus.nombre)) IN ('campus centro', 'campus santiago')
           OR lower(btrim(campus.nombre)) LIKE 'campus san dami%n'
         )
       RETURNING id_ceremonia::text AS id`,
      [
        codigo,
        nombreNormalizado,
        fecha,
        Number(maxInvitadosPorGraduando),
        espacioId,
        periodoNormalizado,
      ]
    );

    if (insertado.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'El auditorio seleccionado no existe, está inactivo o no pertenece a un campus permitido.',
      });
    }

    const resultado = await obtenerCeremonia(insertado.rows[0].id);
    return res.status(201).json(resultado.rows[0]);
  } catch (error) {
    console.error('Error al crear ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No fue posible crear la ceremonia.',
    });
  }
}

export async function listarSesionesCeremonia(req, res) {
  const { id } = req.params;
  if (!ID_INTEGER_REGEX.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  try {
    const ceremonia = await pool.query(
      'SELECT 1 FROM public.ceremonia_grado WHERE id_ceremonia = $1',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const resultado = await pool.query(
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
         (
           SELECT COUNT(*)::integer
           FROM public.graduando g
           WHERE g.id_sesion = s.id_sesion
         ) AS "graduandosCount",
         (
           SELECT COUNT(*)::integer
           FROM public.invitado i
           INNER JOIN public.graduando g ON g.id_graduando = i.id_graduando
           WHERE g.id_sesion = s.id_sesion
         ) AS "invitadosCount"
       FROM public.sesion s
       LEFT JOIN public.sesion_programa sp
         ON sp.id_sesion = s.id_sesion
       LEFT JOIN public.programa p
         ON p.id_programa = sp.id_programa
       WHERE s.id_ceremonia = $1
       GROUP BY s.id_sesion
       ORDER BY s.numero_sesion`,
      [id]
    );

    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar sesiones de ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar las sesiones de la ceremonia.',
    });
  }
}

export async function listarProgramasCeremonia(req, res) {
  try {
    const resultado = await pool.query(
      `SELECT id_programa, nombre, estado
       FROM public.programa
       ORDER BY nombre`
    );
    return res.json(resultado.rows);
  } catch (error) {
    console.error('Error al consultar programas para ceremonias:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar los programas académicos.',
    });
  }
}

export async function listarGraduandosCeremonia(req, res) {
  const { id } = req.params;
  if (!ID_INTEGER_REGEX.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  const { search, sesion, programa } = req.query;
  if (
    (search !== undefined && typeof search !== 'string')
    || (sesion !== undefined && typeof sesion !== 'string')
    || (programa !== undefined && typeof programa !== 'string')
  ) {
    return res.status(400).json({ mensaje: 'Los filtros de graduandos no son válidos.' });
  }

  const condiciones = ['g.id_ceremonia = $1'];
  const valores = [id];

  if (search?.trim()) {
    valores.push(`%${search.trim()}%`);
    const parametro = `$${valores.length}`;
    condiciones.push(
      `(g.nombres ILIKE ${parametro}
        OR g.apellidos ILIKE ${parametro}
        OR g.identificacion ILIKE ${parametro})`
    );
  }

  if (sesion === 'sin-asignar') {
    condiciones.push('g.id_sesion IS NULL');
  } else if (sesion) {
    if (!ID_INTEGER_REGEX.test(sesion) || !Number.isSafeInteger(Number(sesion))) {
      return res.status(400).json({ mensaje: 'El filtro de sesión no es válido.' });
    }
    valores.push(sesion);
    condiciones.push(`g.id_sesion = $${valores.length}`);
  }

  if (programa) {
    const programaId = Number(programa);
    if (!Number.isInteger(programaId) || programaId <= 0) {
      return res.status(400).json({ mensaje: 'El filtro de programa no es válido.' });
    }
    valores.push(programaId);
    condiciones.push(
      `EXISTS (
        SELECT 1
        FROM public.graduando_programa gp_filtro
        WHERE gp_filtro.id_graduando = g.id_graduando
          AND gp_filtro.id_programa = $${valores.length}
      )`
    );
  }

  try {
    const ceremonia = await pool.query(
      'SELECT 1 FROM public.ceremonia_grado WHERE id_ceremonia = $1',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const where = condiciones.join(' AND ');
    const [graduandos, estadisticas] = await Promise.all([
      pool.query(
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
             (
               SELECT STRING_AGG(DISTINCT p.nombre, ', ' ORDER BY p.nombre)
               FROM public.graduando_programa gp
               INNER JOIN public.programa p
                 ON p.id_programa = gp.id_programa
               WHERE gp.id_graduando = g.id_graduando
             ),
             'Sin programa'
           ) AS programa,
           COALESCE(
             (
               SELECT ARRAY_AGG(gp.id_programa ORDER BY gp.id_programa)
               FROM public.graduando_programa gp
               WHERE gp.id_graduando = g.id_graduando
             ),
             ARRAY[]::integer[]
           ) AS "programaIds",
           s.nombre AS "sesionLabel",
           (
             SELECT COUNT(*)::integer
             FROM public.invitado i
             WHERE i.id_graduando = g.id_graduando
           ) AS "invitadosCount",
           g.requisitos_cumplidos AS "requisitosCumplidos",
           g.estado,
           CASE WHEN EXISTS (
             SELECT 1
             FROM public.control_ingreso ci
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
         LEFT JOIN public.sesion s
           ON s.id_sesion = g.id_sesion
         WHERE ${where}
         ORDER BY g.apellidos, g.nombres`,
        valores
      ),
      pool.query(
        `SELECT
           COUNT(*)::integer AS total,
           COUNT(*) FILTER (WHERE requisitos_cumplidos)::integer AS revisados,
           0::integer AS errores
         FROM public.graduando
         WHERE id_ceremonia = $1`,
        [id]
      ),
    ]);

    return res.json({
      data: graduandos.rows,
      total: graduandos.rowCount,
      stats: estadisticas.rows[0],
    });
  } catch (error) {
    console.error('Error al consultar graduandos de ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar los graduandos de la ceremonia.',
    });
  }
}

export async function obtenerFotografiasCeremonia(req, res) {
  const { id } = req.params;
  if (!ID_INTEGER_REGEX.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  try {
    const ceremonia = await pool.query(
      'SELECT 1 FROM public.ceremonia_grado WHERE id_ceremonia = $1',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const resultado = await pool.query(
      `SELECT
         evidencia_fotografia_1,
         evidencia_fotografia_2,
         evidencia_fotografia_3,
         evidencia_fotografia_4
       FROM public.ceremonia_grado
       WHERE id_ceremonia = $1`,
      [id]
    );

    const fotos = [];
    for (let slot = 1; slot <= MAX_FOTOS_CEREMONIA; slot += 1) {
      const contenido = resultado.rows[0][`evidencia_fotografia_${slot}`];
      if (!contenido) continue;
      const mimeType = detectarMimeType(contenido);
      if (!mimeType) {
        throw new Error(`No se pudo identificar el formato de la fotografía ${slot}.`);
      }
      fotos.push({ slot, mimeType, base64: contenido.toString('base64'), version: versionFoto(contenido) });
    }

    return res.json({ fotos });
  } catch (error) {
    console.error('Error al consultar fotografías de ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar las fotografías de la ceremonia.',
    });
  }
}

export async function guardarFotografiasCeremonia(req, res) {
  const { id } = req.params;
  if (!ID_INTEGER_REGEX.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  const { fotos } = req.body ?? {};
  if (
    !Array.isArray(fotos)
    || fotos.length === 0
    || fotos.length > MAX_FOTOS_CEREMONIA
  ) {
    return res.status(400).json({
      mensaje: 'Debes enviar entre una y cuatro fotografías por solicitud.',
    });
  }

  const fotosValidadas = fotos.map(validarFoto);
  const fotoInvalida = fotosValidadas.find((foto) => foto.error);
  if (fotoInvalida) {
    return res.status(400).json({ mensaje: fotoInvalida.error });
  }

  const client = await pool.connect();
  let transaccionIniciada = false;
  try {
    await client.query('BEGIN');
    transaccionIniciada = true;

    const ceremonia = await client.query(
      `SELECT id_ceremonia, evidencia_fotografia_1, evidencia_fotografia_2,
              evidencia_fotografia_3, evidencia_fotografia_4
       FROM public.ceremonia_grado
       WHERE id_ceremonia = $1
       FOR UPDATE`,
      [id]
    );
    if (ceremonia.rowCount === 0) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const slotsOcupados = new Set(
      Array.from({ length: MAX_FOTOS_CEREMONIA }, (_, index) => index + 1)
        .filter((slot) => ceremonia.rows[0][`evidencia_fotografia_${slot}`]),
    );
    const slotsDisponibles = Array.from(
      { length: MAX_FOTOS_CEREMONIA },
      (_, indice) => indice + 1
    ).filter((slot) => !slotsOcupados.has(slot));

    if (fotosValidadas.length > slotsDisponibles.length) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;
      return res.status(409).json({
        mensaje: `Solo quedan ${slotsDisponibles.length} espacios para fotografías.`,
      });
    }

    const fotografias = [];
    for (const [indice, foto] of fotosValidadas.entries()) {
      const columna = `evidencia_fotografia_${slotsDisponibles[indice]}`;
      const contenido = Buffer.from(foto.base64, 'base64');
      await client.query(
        `UPDATE public.ceremonia_grado
         SET ${columna} = $1
         WHERE id_ceremonia = $2`,
        [contenido, id],
      );
      fotografias.push({ slot: slotsDisponibles[indice], version: versionFoto(contenido) });
    }

    await client.query('COMMIT');
    transaccionIniciada = false;
    return res.json({
      guardadas: fotosValidadas.length,
      espaciosDisponibles: slotsDisponibles.length - fotosValidadas.length,
      fotografias,
    });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error al revertir la carga de fotografías:', rollbackError);
      }
    }
    console.error('Error al guardar fotografías de ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No fue posible guardar las fotografías de la ceremonia.',
    });
  } finally {
    client.release();
  }
}

export async function eliminarFotografiaCeremonia(req, res) {
  const { id, slot } = req.params;
  if (!ID_INTEGER_REGEX.test(id) || !Number.isSafeInteger(Number(id))) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }
  if (!/^[1-4]$/.test(slot)) {
    return res.status(400).json({ mensaje: 'El espacio de fotografía no es válido.' });
  }
  const ifMatch = req.get('If-Match');
  if (typeof ifMatch !== 'string' || !/^"[a-f0-9]{64}"$/.test(ifMatch)) {
    return res.status(400).json({ mensaje: 'La versión de la fotografía no es válida.' });
  }
  const version = ifMatch.slice(1, -1);

  const columna = `evidencia_fotografia_${slot}`;
  let client;
  let transaccionIniciada = false;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    transaccionIniciada = true;
    const resultado = await client.query(
      `SELECT ${columna} AS fotografia
       FROM public.ceremonia_grado
       WHERE id_ceremonia = $1
       FOR UPDATE`,
      [id],
    );
    if (resultado.rowCount === 0) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }
    const contenido = resultado.rows[0].fotografia;
    if (!contenido || versionFoto(contenido) !== version) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;
      return res.status(409).json({
        mensaje: 'La fotografía cambió o ya fue eliminada. Actualiza la página para ver las fotografías actuales.',
      });
    }

    await client.query(
      `UPDATE public.ceremonia_grado SET ${columna} = NULL WHERE id_ceremonia = $1`,
      [id],
    );
    await client.query('COMMIT');
    transaccionIniciada = false;
    return res.json({ mensaje: 'Fotografía eliminada.' });
  } catch (error) {
    if (transaccionIniciada) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        console.error('Error al revertir la eliminación de la fotografía:', rollbackError);
      }
    }
    console.error('Error al eliminar fotografía de ceremonia:', error);
    return res.status(500).json({ mensaje: 'No fue posible eliminar la fotografía de la ceremonia.' });
  } finally {
    client?.release();
  }
}
