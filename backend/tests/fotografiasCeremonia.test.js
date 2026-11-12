import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import {
  eliminarFotografiaCeremonia,
  guardarFotografiasCeremonia,
  obtenerFotografiasCeremonia,
} from '../src/controllers/ceremoniasController.js';

const imagenA = Buffer.from('89504e470d0a1a0a010203', 'hex');
const imagenB = Buffer.from('89504e470d0a1a0a040506', 'hex');
const version = (contenido) => createHash('sha256').update(contenido).digest('hex');
const foto = (contenido) => ({ mimeType: 'image/png', base64: contenido.toString('base64') });

async function conBase(inicial, ejecutar) {
  const connectOriginal = pool.connect;
  const queryOriginal = pool.query;
  const columnas = { ...inicial };
  const consultas = [];
  async function query(sql, valores = []) {
    consultas.push({ sql, valores });
    if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
    if (sql.startsWith('SELECT 1 FROM public.ceremonia_grado')) {
      return { rows: valores[0] === '1' ? [{}] : [], rowCount: valores[0] === '1' ? 1 : 0 };
    }
    if (sql.includes('FROM public.ceremonia_grado')) {
      if (valores[0] !== '1') return { rows: [], rowCount: 0 };
      const seleccion = sql.match(/SELECT (evidencia_fotografia_[1-4]) AS fotografia/);
      if (seleccion) return { rows: [{ fotografia: columnas[seleccion[1]] }], rowCount: 1 };
      return { rows: [{ ...columnas }], rowCount: 1 };
    }
    if (sql.includes('UPDATE public.ceremonia_grado')) {
      const columna = sql.match(/SET (evidencia_fotografia_[1-4]) = (NULL|\$1)/);
      assert.ok(columna, `Consulta inesperada: ${sql}`);
      columnas[columna[1]] = columna[2] === 'NULL' ? null : valores[0];
      return { rows: [], rowCount: 1 };
    }
    throw new Error(`Consulta inesperada: ${sql}`);
  }
  pool.connect = async () => ({ query, release() {} });
  pool.query = query;
  try {
    return await ejecutar({ columnas, consultas });
  } finally {
    pool.connect = connectOriginal;
    pool.query = queryOriginal;
  }
}

async function llamar(controlador, params, body = {}, versionActual = undefined) {
  const res = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(resultado) { this.body = resultado; return this; },
  };
  await controlador({
    params, body,
    get(nombre) { return nombre === 'If-Match' && versionActual !== undefined ? `"${versionActual}"` : undefined; },
  }, res);
  return res;
}

test('elimina solo la imagen elegida y el espacio queda disponible para otra', async () => {
  await conBase({ evidencia_fotografia_1: imagenA, evidencia_fotografia_2: imagenB }, async ({ columnas, consultas }) => {
    const listado = await llamar(obtenerFotografiasCeremonia, { id: '1' });
    assert.deepEqual(listado.body.fotos.map((item) => [item.slot, item.version]), [
      [1, version(imagenA)], [2, version(imagenB)],
    ]);

    const eliminada = await llamar(eliminarFotografiaCeremonia, { id: '1', slot: '1' }, {}, version(imagenA));
    assert.equal(eliminada.statusCode, 200);
    assert.equal(columnas.evidencia_fotografia_1, null);
    assert.deepEqual(columnas.evidencia_fotografia_2, imagenB);
    assert.ok(consultas.some(({ sql }) => sql.includes('FOR UPDATE')));

    const guardada = await llamar(guardarFotografiasCeremonia, { id: '1' }, { fotos: [foto(imagenB)] });
    assert.equal(guardada.statusCode, 200);
    assert.deepEqual(guardada.body.fotografias, [{ slot: 1, version: version(imagenB) }]);
    assert.deepEqual(columnas.evidencia_fotografia_1, imagenB);
  });
});

test('no elimina una fotografía reemplazada o ya eliminada desde otra ventana', async () => {
  await conBase({ evidencia_fotografia_1: imagenB }, async ({ columnas, consultas }) => {
    const reemplazada = await llamar(eliminarFotografiaCeremonia, { id: '1', slot: '1' }, {}, version(imagenA));
    assert.equal(reemplazada.statusCode, 409);
    assert.deepEqual(columnas.evidencia_fotografia_1, imagenB);
    assert.ok(consultas.some(({ sql }) => sql === 'ROLLBACK'));
    assert.ok(!consultas.some(({ sql }) => sql.includes('UPDATE public.ceremonia_grado')));

    const vacia = await llamar(eliminarFotografiaCeremonia, { id: '1', slot: '3' }, {}, version(imagenA));
    assert.equal(vacia.statusCode, 409);
  });
});

test('valida ceremonia, espacio y versión antes de consultar la base', async () => {
  await conBase({}, async ({ consultas }) => {
    for (const [params, versionActual] of [
      [{ id: '0', slot: '1' }, version(imagenA)],
      [{ id: '1', slot: '5' }, version(imagenA)],
      [{ id: '1', slot: '1; DROP TABLE' }, version(imagenA)],
      [{ id: '1', slot: '1' }, 'incorrecta'],
      [{ id: '1', slot: '1' }, undefined],
    ]) {
      assert.equal((await llamar(eliminarFotografiaCeremonia, params, {}, versionActual)).statusCode, 400);
    }
    assert.equal(consultas.length, 0);
  });
});

test('informa si la ceremonia no existe', async () => {
  await conBase({}, async ({ consultas }) => {
    const res = await llamar(eliminarFotografiaCeremonia, { id: '2', slot: '1' }, {}, version(imagenA));
    assert.equal(res.statusCode, 404);
    assert.ok(consultas.some(({ sql }) => sql === 'ROLLBACK'));
  });
});

after(async () => { await pool.end(); });
