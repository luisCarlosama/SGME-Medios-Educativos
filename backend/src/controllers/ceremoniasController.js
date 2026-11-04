import { randomUUID } from 'node:crypto';
import pool from '../db.js';

const ESTADOS_CEREMONIA = new Set([
  'Programada',
  'En curso',
  'Finalizada',
  'Cancelada',
]);

const ID_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FOTOS_CEREMONIA = 4;
const MAX_FOTO_BYTES = 3 * 1024 * 1024;
const TIPOS_FOTO = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

const SELECT_CEREMONIAS = `
  SELECT
    c.id::text AS id,
    c.codigo,
    c.nombre,
    TO_CHAR(c.fecha, 'DD/MM/YYYY') AS fecha,
    TO_CHAR(c.fecha, 'YYYY-MM-DD') AS "fechaISO",
    e.nombre AS lugar,
    campus.nombre AS campus,
    COUNT(DISTINCT s.id)::integer AS sesiones,
    (
      SELECT COUNT(*)::integer
      FROM public.sgme_ceremonia_graduando g
      WHERE g.id_ceremonia = c.id
    ) AS graduandos,
    (
      SELECT COUNT(*)::integer
      FROM public.sgme_ceremonia_invitado i
      WHERE i.id_ceremonia = c.id
    ) AS invitados,
    c.estado,
    c.max_invitados_por_graduando AS "maxInvitadosPorGraduando",
    c.cupo_invitados AS "cupoInvitados"
  FROM public.sgme_ceremonia c
  INNER JOIN public.espacio e
    ON e.id_espacio = c.id_espacio
  INNER JOIN public.campus campus
    ON campus.id_campus = e.id_campus
  LEFT JOIN public.sgme_ceremonia_sesion s
    ON s.id_ceremonia = c.id
`;

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
      WHERE c.id = $1
      GROUP BY c.id, e.nombre, campus.nombre`,
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
        GROUP BY c.id, e.nombre, campus.nombre
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
  if (!ID_UUID_REGEX.test(id)) {
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

  if (!Number.isInteger(espacioId) || espacioId <= 0) {
    return res.status(400).json({ mensaje: 'El espacio seleccionado no es válido.' });
  }

  if (!ESTADOS_CEREMONIA.has(estado)) {
    return res.status(400).json({ mensaje: 'El estado indicado no es válido.' });
  }

  if (![2, 3, 4].includes(Number(maxInvitadosPorGraduando))) {
    return res.status(400).json({
      mensaje: 'El máximo de invitados por graduando debe ser 2, 3 o 4.',
    });
  }

  const id = randomUUID();
  const codigo = `CER-${fecha.slice(0, 4)}-${id.slice(0, 8).toUpperCase()}`;

  try {
    const insertado = await pool.query(
      `INSERT INTO public.sgme_ceremonia (
         id, codigo, nombre, fecha, id_espacio, estado, max_invitados_por_graduando
       )
       SELECT $1, $2, $3, $4::date, e.id_espacio, $5, $6
       FROM public.espacio e
       WHERE e.id_espacio = $7 AND e.estado = TRUE`,
      [
        id,
        codigo,
        nombreNormalizado,
        fecha,
        estado,
        Number(maxInvitadosPorGraduando),
        espacioId,
      ]
    );

    if (insertado.rowCount === 0) {
      return res.status(404).json({
        mensaje: 'El espacio seleccionado no existe o está inactivo.',
      });
    }

    const resultado = await obtenerCeremonia(id);
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
  if (!ID_UUID_REGEX.test(id)) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  try {
    const ceremonia = await pool.query(
      'SELECT 1 FROM public.sgme_ceremonia WHERE id = $1',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const resultado = await pool.query(
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
         (
           SELECT COUNT(*)::integer
           FROM public.sgme_ceremonia_graduando g
           WHERE g.id_sesion = s.id
         ) AS "graduandosCount",
         (
           SELECT COUNT(*)::integer
           FROM public.sgme_ceremonia_invitado i
           INNER JOIN public.sgme_ceremonia_graduando g ON g.id = i.id_graduando
           WHERE g.id_sesion = s.id
         ) AS "invitadosCount"
       FROM public.sgme_ceremonia_sesion s
       LEFT JOIN public.sgme_ceremonia_sesion_programa sp
         ON sp.id_sesion = s.id
       LEFT JOIN public.programa p
         ON p.id_programa = sp.id_programa
       WHERE s.id_ceremonia = $1
       GROUP BY s.id
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
  if (!ID_UUID_REGEX.test(id)) {
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
        OR g.documento ILIKE ${parametro})`
    );
  }

  if (sesion === 'sin-asignar') {
    condiciones.push('g.id_sesion IS NULL');
  } else if (sesion) {
    if (!ID_UUID_REGEX.test(sesion)) {
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
        FROM public.sgme_ceremonia_graduando_programa gp_filtro
        WHERE gp_filtro.id_graduando = g.id
          AND gp_filtro.id_programa = $${valores.length}
      )`
    );
  }

  try {
    const ceremonia = await pool.query(
      'SELECT 1 FROM public.sgme_ceremonia WHERE id = $1',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const where = condiciones.join(' AND ');
    const [graduandos, estadisticas] = await Promise.all([
      pool.query(
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
             (
               SELECT STRING_AGG(DISTINCT p.nombre, ', ' ORDER BY p.nombre)
               FROM public.sgme_ceremonia_graduando_programa gp
               INNER JOIN public.programa p
                 ON p.id_programa = gp.id_programa
               WHERE gp.id_graduando = g.id
             ),
             'Sin programa'
           ) AS programa,
           COALESCE(
             (
               SELECT ARRAY_AGG(gp.id_programa ORDER BY gp.id_programa)
               FROM public.sgme_ceremonia_graduando_programa gp
               WHERE gp.id_graduando = g.id
             ),
             ARRAY[]::integer[]
           ) AS "programaIds",
           s.nombre AS "sesionLabel",
           (
             SELECT COUNT(*)::integer
             FROM public.sgme_ceremonia_invitado i
             WHERE i.id_graduando = g.id
           ) AS "invitadosCount",
           g.requisitos_cumplidos AS "requisitosCumplidos",
           g.estado,
           CASE WHEN g.ingreso_at IS NULL THEN 'Pendiente' ELSE 'Ingresó' END AS "estadoIngreso",
           TO_CHAR(g.ingreso_at, 'FMHH12:MI AM') AS "horaIngreso"
         FROM public.sgme_ceremonia_graduando g
         LEFT JOIN public.sgme_ceremonia_sesion s
           ON s.id = g.id_sesion
         WHERE ${where}
         ORDER BY g.apellidos, g.nombres`,
        valores
      ),
      pool.query(
        `SELECT
           COUNT(*)::integer AS total,
           COUNT(*) FILTER (WHERE requisitos_cumplidos)::integer AS revisados,
           0::integer AS errores
         FROM public.sgme_ceremonia_graduando
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
  if (!ID_UUID_REGEX.test(id)) {
    return res.status(400).json({ mensaje: 'El identificador de ceremonia no es válido.' });
  }

  try {
    const ceremonia = await pool.query(
      'SELECT 1 FROM public.sgme_ceremonia WHERE id = $1',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const resultado = await pool.query(
      `SELECT
         slot,
         mime_type AS "mimeType",
         base64
       FROM public.sgme_ceremonia_fotografia
       WHERE id_ceremonia = $1
       ORDER BY slot`,
      [id]
    );

    return res.json({ fotos: resultado.rows });
  } catch (error) {
    console.error('Error al consultar fotografías de ceremonia:', error);
    return res.status(500).json({
      mensaje: 'No se pudieron consultar las fotografías de la ceremonia.',
    });
  }
}

export async function guardarFotografiasCeremonia(req, res) {
  const { id } = req.params;
  if (!ID_UUID_REGEX.test(id)) {
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
      'SELECT id FROM public.sgme_ceremonia WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (ceremonia.rowCount === 0) {
      await client.query('ROLLBACK');
      transaccionIniciada = false;
      return res.status(404).json({ mensaje: 'La ceremonia no existe.' });
    }

    const fotosGuardadas = await client.query(
      `SELECT slot
       FROM public.sgme_ceremonia_fotografia
       WHERE id_ceremonia = $1
       ORDER BY slot`,
      [id]
    );
    const slotsOcupados = new Set(fotosGuardadas.rows.map((foto) => foto.slot));
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

    for (const [indice, foto] of fotosValidadas.entries()) {
      await client.query(
        `INSERT INTO public.sgme_ceremonia_fotografia (
           id_ceremonia, slot, mime_type, base64, tamano_bytes
         )
         VALUES ($1, $2, $3, $4, $5)`,
        [id, slotsDisponibles[indice], foto.mimeType, foto.base64, foto.tamanoBytes]
      );
    }

    await client.query('COMMIT');
    transaccionIniciada = false;
    return res.json({
      guardadas: fotosValidadas.length,
      espaciosDisponibles: slotsDisponibles.length - fotosValidadas.length,
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
