import assert from 'node:assert/strict';
import { test } from 'node:test';
import { obtenerPoolInstitucional } from '../src/dbInstitucional.js';
import { consultarColumnasInstitucionales, consultarGraduandosInstitucionales } from '../src/services/institucionalService.js';
import { listarGraduandosInstitucionales } from '../src/controllers/ceremoniasController.js';

test('exige una configuración institucional explícita', () => {
  delete process.env.INSTITUCIONAL_DB_HOST;
  assert.throws(obtenerPoolInstitucional, /Falta configurar/);
});

test('consulta únicamente las columnas de las dos vistas permitidas', async () => {
  const consultas = [];
  const executor = {
    async query(consulta) {
      consultas.push(consulta);
      return { fields: [{ name: 'codigo' }, { name: 'nombre' }] };
    },
  };

  const vistas = await consultarColumnasInstitucionales(executor, 'esquema"prueba');
  assert.deepEqual(consultas, [
    'SELECT * FROM "esquema""prueba"."vista_info_graduandos" LIMIT 0',
    'SELECT * FROM "esquema""prueba"."vista_informacion_estudiantes" LIMIT 0',
  ]);
  assert.deepEqual(vistas, [
    { vista: 'vista_info_graduandos', columnas: ['codigo', 'nombre'] },
    { vista: 'vista_informacion_estudiantes', columnas: ['codigo', 'nombre'] },
  ]);
});

test('crea una conexión independiente con la configuración institucional', async () => {
  process.env.INSTITUCIONAL_DB_HOST = 'institucional.example';
  process.env.INSTITUCIONAL_DB_PORT = '5433';
  process.env.INSTITUCIONAL_DB_NAME = 'pruebas';
  process.env.INSTITUCIONAL_DB_USER = 'lector';
  process.env.INSTITUCIONAL_DB_PASSWORD = 'prueba';
  process.env.INSTITUCIONAL_DB_SSL = 'true';

  const pool = obtenerPoolInstitucional();
  assert.equal(pool.options.host, 'institucional.example');
  assert.equal(pool.options.port, 5433);
  assert.equal(pool.options.database, 'pruebas');
  assert.equal(pool.options.user, 'lector');
  assert.equal(pool.options.ssl.rejectUnauthorized, true);
  assert.equal(obtenerPoolInstitucional(), pool);
  await pool.end();
});

test('consulta graduandos sin modificarlos y limita la pagina', async () => {
  const executor = {
    async query(consulta, parametros) {
      assert.match(consulta, /^SELECT /);
      assert.match(consulta, /FROM "esquema""prueba"\."vista_info_graduandos"/);
      assert.deepEqual(parametros, [26, 25]);
      return { rows: Array.from({ length: 26 }, (_, index) => ({ nombre: `Prueba ${index}` })) };
    },
  };

  const resultado = await consultarGraduandosInstitucionales(executor, 'esquema"prueba', 2);
  assert.equal(resultado.data.length, 25);
  assert.equal(resultado.pagina, 2);
  assert.equal(resultado.haySiguiente, true);
});

test('la consulta institucional rechaza conexiones remotas y produccion', async () => {
  const previewOriginal = process.env.INSTITUCIONAL_PREVIEW_LOCAL;
  const entornoOriginal = process.env.NODE_ENV;
  const response = {
    statusCode: 200,
    status(codigo) { this.statusCode = codigo; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    process.env.INSTITUCIONAL_PREVIEW_LOCAL = 'true';
    process.env.NODE_ENV = 'development';
    await listarGraduandosInstitucionales({ socket: { remoteAddress: '192.0.2.1' }, query: {} }, response);
    assert.equal(response.statusCode, 403);
    process.env.NODE_ENV = 'production';
    await listarGraduandosInstitucionales({ socket: { remoteAddress: '127.0.0.1' }, query: {} }, response);
    assert.equal(response.statusCode, 403);
  } finally {
    if (previewOriginal === undefined) delete process.env.INSTITUCIONAL_PREVIEW_LOCAL;
    else process.env.INSTITUCIONAL_PREVIEW_LOCAL = previewOriginal;
    if (entornoOriginal === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = entornoOriginal;
  }
});