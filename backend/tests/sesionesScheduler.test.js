import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import pool from '../src/db.js';
import { actualizarEstadosPorHorario } from '../src/services/sesionesScheduler.js';

test('automatiza solo ceremonias en curso y respeta el bloqueo antes de cambiar sesiones', async () => {
  const queryOriginal = pool.query;
  const connectOriginal = pool.connect;
  const gradoPruebaOriginal = process.env.GRADO_PRUEBA_HABILITADA;
  const consultas = [];
  let conexiones = 0;
  pool.query = async (sql) => {
    assert.match(sql, /WHERE estado = 'En curso'/);
    return { rows: [{ id: '1' }, { id: '2' }] };
  };
  pool.connect = async () => {
    const numero = ++conexiones;
    return {
      async query(sql, valores = []) {
        consultas.push({ numero, sql, valores });
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [] };
        if (sql.includes('SELECT 1 FROM public.ceremonia_grado')) {
          assert.match(sql, /estado = 'En curso'/);
          assert.match(sql, /FOR UPDATE/);
          return { rows: numero === 1 ? [{}] : [], rowCount: numero === 1 ? 1 : 0 };
        }
        if (sql.includes('UPDATE public.sesion')) {
          assert.match(sql, /c\.estado = 'En curso'/);
          assert.match(sql, /s\.estado_manual = FALSE/);
          return { rows: [], rowCount: 0 };
        }
        if (sql.includes('UPDATE public.ceremonia_grado')) return { rows: [{}], rowCount: 1 };
        if (sql.includes('UPDATE public.proceso_grado_ceremonia')) return { rows: [], rowCount: 0 };
        throw new Error(`Consulta inesperada: ${sql}`);
      },
      release() {},
    };
  };
  process.env.GRADO_PRUEBA_HABILITADA = 'false';
  try {
    await actualizarEstadosPorHorario();
    const primera = consultas.filter(({ numero }) => numero === 1);
    const bloqueo = primera.findIndex(({ sql }) => sql.includes('FOR UPDATE'));
    const sesiones = primera.findIndex(({ sql }) => sql.includes('UPDATE public.sesion'));
    const ceremonia = primera.findIndex(({ sql }) => sql.includes('UPDATE public.ceremonia_grado'));
    assert.ok(bloqueo >= 0 && bloqueo < sesiones && sesiones < ceremonia);
    assert.ok(primera.some(({ sql }) => sql.includes('UPDATE public.proceso_grado_ceremonia')));
    assert.ok(primera.some(({ sql }) => sql === 'COMMIT'));
    const segunda = consultas.filter(({ numero }) => numero === 2);
    assert.ok(!segunda.some(({ sql }) => sql.includes('UPDATE public.sesion')));
    assert.ok(segunda.some(({ sql }) => sql === 'COMMIT'));
  } finally {
    pool.query = queryOriginal;
    pool.connect = connectOriginal;
    if (gradoPruebaOriginal === undefined) delete process.env.GRADO_PRUEBA_HABILITADA;
    else process.env.GRADO_PRUEBA_HABILITADA = gradoPruebaOriginal;
  }
});

after(async () => { await pool.end(); });
