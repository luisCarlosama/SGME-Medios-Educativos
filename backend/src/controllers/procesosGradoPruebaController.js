import pool from '../db.js';
import { obtenerPoolProcesosPrueba } from '../dbProcesosPrueba.js';
import { sincronizarGradosPrueba } from '../services/sincronizacionGradosPrueba.js';

function accesoPrueba(req, res) {
  const local = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
  if (process.env.NODE_ENV === 'production' || process.env.GRADO_PRUEBA_HABILITADA !== 'true'
      || !local.has(req.socket.remoteAddress)
      || !['localhost', '127.0.0.1', '::1'].includes(process.env.DB_HOST)
      || !/^sgme_app_prueba_[a-z0-9_]+$/.test(process.env.DB_NAME || '')) {
    res.status(403).json({ mensaje: 'Esta función solo está disponible en el entorno local de pruebas aislado.' });
    return false;
  }
  return true;
}

function responderError(res, error) {
  if (error.status) return res.status(error.status).json({ mensaje: error.message });
  console.error('Error en procesos de grado de prueba:', error.message);
  return res.status(500).json({ mensaje: 'No fue posible completar la operación de prueba.' });
}

function errorHttp(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function idValido(id) {
  return typeof id === 'string' && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));
}

export async function listarCatalogoEstados(req, res) {
  if (!accesoPrueba(req, res)) return;
  try {
    const resultado = await pool.query(
      'SELECT id_estado AS id, nombre, elegible FROM public.catalogo_estado_grado ORDER BY nombre',
    );
    return res.json(resultado.rows);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function guardarEstadoCatalogo(req, res) {
  if (!accesoPrueba(req, res)) return;
  try {
    const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
    const { elegible } = req.body ?? {};
    if (!nombre || nombre.length > 100 || typeof elegible !== 'boolean') {
      throw errorHttp(400, 'Indica un nombre de estado válido y si es elegible.');
    }
    if (nombre.toLocaleLowerCase('es') === 'titulado' && elegible) {
      throw errorHttp(400, 'El estado Titulado no puede ser elegible.');
    }
    const resultado = await pool.query(
      `INSERT INTO public.catalogo_estado_grado (nombre, elegible) VALUES ($1, $2)
       ON CONFLICT (nombre) DO UPDATE SET elegible = EXCLUDED.elegible
       RETURNING id_estado AS id, nombre, elegible`,
      [nombre, elegible],
    );
    return res.json(resultado.rows[0]);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function listarCandidatosPrueba(req, res) {
  if (!accesoPrueba(req, res)) return;
  try {
    if (!idValido(req.params.id)) throw errorHttp(400, 'El identificador de ceremonia no es válido.');
    const ceremonia = await pool.query(
      'SELECT periodo_grado FROM public.ceremonia_grado WHERE id_ceremonia = $1',
      [req.params.id],
    );
    if (!ceremonia.rowCount) throw errorHttp(404, 'La ceremonia no existe.');
    if (!ceremonia.rows[0].periodo_grado) throw errorHttp(409, 'La ceremonia no tiene un periodo de grado.');
    const estados = await pool.query('SELECT nombre FROM public.catalogo_estado_grado WHERE elegible = TRUE');
    const candidatos = await obtenerPoolProcesosPrueba().query(
      `SELECT id_proceso AS id, nombres, apellidos, documento, codigo, programa, periodo, estado
       FROM public.proceso_grado_prueba
       WHERE es_prueba = TRUE AND periodo = $1 AND estado = ANY($2::text[])
       ORDER BY apellidos, nombres, id_proceso`,
      [ceremonia.rows[0].periodo_grado, estados.rows.map((estado) => estado.nombre)],
    );
    res.set('Cache-Control', 'no-store');
    return res.json(candidatos.rows);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function listarSincronizacionesPrueba(req, res) {
  if (!accesoPrueba(req, res)) return;
  try {
    const resultado = await pool.query(
      `SELECT p.id_graduando AS id, g.nombres, g.apellidos, c.nombre AS ceremonia,
              p.estado_sincronizacion AS estado, p.error_sincronizacion AS error
       FROM public.proceso_grado_ceremonia p
       INNER JOIN public.graduando g ON g.id_graduando = p.id_graduando
       INNER JOIN public.ceremonia_grado c ON c.id_ceremonia = g.id_ceremonia
       WHERE p.origen = 'prueba' AND p.estado_sincronizacion <> 'Sin solicitar'
       ORDER BY p.id_graduando`,
    );
    return res.json(resultado.rows);
  } catch (error) {
    return responderError(res, error);
  }
}

export async function reintentarSincronizacionesPrueba(req, res) {
  if (!accesoPrueba(req, res)) return;
  try {
    return res.json(await sincronizarGradosPrueba());
  } catch (error) {
    return responderError(res, error);
  }
}

export async function agregarCandidatoPrueba(req, res) {
  if (!accesoPrueba(req, res)) return;
  let client;
  let transaccion = false;
  try {
    const procesoId = req.body?.procesoId;
    const programaId = Number(req.body?.programaId);
    if (!idValido(req.params.id) || typeof procesoId !== 'string'
        || !/^ficticio-[a-z0-9-]+$/.test(procesoId)
        || !Number.isSafeInteger(programaId) || programaId <= 0) {
      throw errorHttp(400, 'El proceso o el programa de prueba no es válido.');
    }

    const proceso = await obtenerPoolProcesosPrueba().query(
      `SELECT id_proceso, nombres, apellidos, documento, codigo, periodo, estado
       FROM public.proceso_grado_prueba WHERE es_prueba = TRUE AND id_proceso = $1`,
      [procesoId],
    );
    if (!proceso.rowCount) throw errorHttp(404, 'El proceso ficticio no existe.');
    const candidato = proceso.rows[0];
    client = await pool.connect();
    await client.query('BEGIN');
    transaccion = true;
    const ceremonia = await client.query(
      'SELECT estado, periodo_grado FROM public.ceremonia_grado WHERE id_ceremonia = $1 FOR UPDATE',
      [req.params.id],
    );
    if (!ceremonia.rowCount) throw errorHttp(404, 'La ceremonia no existe.');
    if (ceremonia.rows[0].estado !== 'Programada' || ceremonia.rows[0].periodo_grado !== candidato.periodo) {
      throw errorHttp(409, 'El proceso no corresponde al periodo de una ceremonia programada.');
    }
    const elegible = await client.query(
      'SELECT 1 FROM public.catalogo_estado_grado WHERE nombre = $1 AND elegible = TRUE',
      [candidato.estado],
    );
    if (!elegible.rowCount) throw errorHttp(409, 'El proceso ya no tiene un estado elegible.');
    const programa = await client.query('SELECT 1 FROM public.programa WHERE id_programa = $1 AND estado = TRUE', [programaId]);
    if (!programa.rowCount) throw errorHttp(400, 'Selecciona un programa activo.');
    const duplicado = await client.query(
      `SELECT 1 FROM public.graduando
       WHERE id_ceremonia = $1 AND COALESCE(
         NULLIF(REGEXP_REPLACE(identificacion, '[^0-9]', '', 'g'), ''),
         LOWER(BTRIM(identificacion))
       ) = $2 LIMIT 1`,
      [req.params.id, candidato.documento.replace(/\D/g, '') || candidato.documento.trim().toLowerCase()],
    );
    if (duplicado.rowCount) throw errorHttp(409, 'Ya existe un graduando con ese documento en esta ceremonia.');
    const insertado = await client.query(
      `INSERT INTO public.graduando (id_ceremonia, nombres, apellidos, identificacion, codigo_estudiantil)
       VALUES ($1, $2, $3, $4, $5) RETURNING id_graduando`,
      [req.params.id, candidato.nombres, candidato.apellidos, candidato.documento, candidato.codigo],
    );
    const graduandoId = insertado.rows[0].id_graduando;
    await client.query('INSERT INTO public.graduando_programa (id_graduando, id_programa) VALUES ($1, $2)', [graduandoId, programaId]);
    await client.query(
      `INSERT INTO public.proceso_grado_ceremonia (id_graduando, origen, id_proceso)
       VALUES ($1, 'prueba', $2)`,
      [graduandoId, procesoId],
    );
    await client.query('COMMIT');
    transaccion = false;
    return res.status(201).json({ id: String(graduandoId) });
  } catch (error) {
    if (transaccion) await client.query('ROLLBACK');
    return responderError(res, error);
  } finally {
    client?.release();
  }
}
